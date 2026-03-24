import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createGmailClient,
  getGmailMessage,
  getMessageHeader,
  getMessageHtmlRaw,
  getMessagePlainText,
  listRecentScotiaMessages,
} from "@/lib/gmail/client";
import { emailBodyForParsing } from "@/lib/parsing/emailBody";
import { extractTransactionsWithGemini } from "@/lib/parsing/geminiExtractor";
import { parseScotiaEmailWithRules } from "@/lib/parsing/scotiaParser";
import { isScotiaCreditCardAlert } from "@/lib/parsing/scotiaCreditCardAlert";
import { filterSpendTransactions } from "@/lib/parsing/spendFilter";
import {
  makeTransactionHash,
  shouldOverwriteExistingStatus,
  type ParsedTransaction,
} from "@/lib/dedupe/transactionHash";
import { decryptSecret } from "@/lib/security/encryption";

export type GmailConnectionRow = {
  user_id: string;
  google_email: string;
  access_token: string | null;
  refresh_token_encrypted: string;
  oauth_redirect_uri?: string | null;
};

function normalizeTx(tx: ParsedTransaction): ParsedTransaction {
  return {
    ...tx,
    merchant: tx.merchant.trim().slice(0, 120),
    category: tx.category || "Other",
    parseConfidence: tx.parseConfidence ?? 0.5,
  };
}

export async function ingestGmailForConnection(
  supabase: SupabaseClient,
  connection: GmailConnectionRow
): Promise<{
  inserted: number;
  updated: number;
  skipped: number;
  upsertFailures: number;
  emailsMatched: number;
  parseErrors: Array<{ user_id: string; message_id: string }>;
  fatalError?: string;
}> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let upsertFailures = 0;
  let emailsMatched = 0;
  const parseErrors: Array<{ user_id: string; message_id: string }> = [];

  try {
    const gmail = createGmailClient(
      {
        access_token: connection.access_token,
        refresh_token: decryptSecret(connection.refresh_token_encrypted),
      },
      connection.oauth_redirect_uri ?? undefined
    );

    const messages = await listRecentScotiaMessages(gmail, 25);
    for (const summary of messages) {
      if (!summary.id) continue;
      const fullMessage = await getGmailMessage(gmail, summary.id);
      const subject = getMessageHeader(fullMessage, "Subject");
      const body = emailBodyForParsing(
        getMessagePlainText(fullMessage),
        getMessageHtmlRaw(fullMessage)
      );
      if (!body) continue;
      if (!isScotiaCreditCardAlert(subject, body)) continue;
      emailsMatched += 1;

      let parsed = await extractTransactionsWithGemini(body);
      if (parsed.length === 0) {
        parsed = parseScotiaEmailWithRules(body);
      }

      const beforeSpendFilter = parsed.length;
      parsed = filterSpendTransactions(parsed, body);

      if (parsed.length === 0) {
        if (beforeSpendFilter === 0) {
          parseErrors.push({ user_id: connection.user_id, message_id: summary.id });
        }
        continue;
      }

      for (const rawTx of parsed) {
        const tx = normalizeTx(rawTx);
        const hash = makeTransactionHash(connection.user_id, tx);

        const { data: existing } = await supabase
          .from("transactions")
          .select("id,status")
          .eq("user_id", connection.user_id)
          .eq("hash_id", hash)
          .maybeSingle();

        if (existing && !shouldOverwriteExistingStatus(existing.status, tx.status)) {
          skipped += 1;
          continue;
        }

        const payload = {
          user_id: connection.user_id,
          date: tx.date,
          merchant: tx.merchant,
          amount: tx.amount,
          category: tx.category,
          hash_id: hash,
          source_email_id: summary.id,
          status: tx.status,
          posted_at: tx.status === "posted" ? tx.date : null,
          parse_confidence: tx.parseConfidence,
        };

        const { error } = await supabase
          .from("transactions")
          .upsert(payload, { onConflict: "user_id,hash_id" });

        if (error) {
          console.error("[ingestGmailForConnection] upsert failed:", error.message);
          upsertFailures += 1;
        } else if (existing) {
          updated += 1;
        } else {
          inserted += 1;
        }
      }
    }

    await supabase
      .from("gmail_connections")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("user_id", connection.user_id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[ingestGmailForConnection] fatal:", e);
    return {
      inserted,
      updated,
      skipped,
      upsertFailures,
      emailsMatched,
      parseErrors,
      fatalError: msg,
    };
  }

  return { inserted, updated, skipped, upsertFailures, emailsMatched, parseErrors };
}

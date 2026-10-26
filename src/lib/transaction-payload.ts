import { TransactionSplitType } from '../models/transactions';

export default function transactionPayload(transactions: TransactionSplitType[], title?: string, externalId?: string) {
  return {
    group_title: title || '',
    transactions: transactions.map((transaction) => ({
      tags: transaction.tags,
      notes: transaction.notes,
      foreign_amount: transaction.foreignAmount ? (externalId ? transaction.foreignAmount.replace(',', '.') : parseFloat(transaction.foreignAmount.replace(',', '.'))) : null,
      foreign_currency_id: transaction.foreignCurrencyId,
      description: transaction.description,
      date: transaction.date,
      source_name: transaction.sourceName,
      source_id: transaction.sourceId,
      destination_name: transaction.destinationName,
      destination_id: transaction.destinationId,
      category_id: transaction.categoryName === '' ? undefined : transaction.categoryId,
      category_name: transaction.categoryName,
      budget_id: transaction.budgetId,
      budget_name: transaction.budgetName,
      type: transaction.type,
      amount: transaction.amount ? (externalId ? transaction.amount.replace(',', '.') : parseFloat(transaction.amount.replace(',', '.'))) : 0,
      bill_id: transaction.billId,
      bill_name: transaction.billName,
      ...(externalId && { external_id: externalId }),
    })),
    error_if_duplicate_hash: !!externalId,
    apply_rules: true,
    fire_webhooks: true,
  };
}

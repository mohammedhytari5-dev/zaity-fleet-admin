export type IncomingReportPayment = { id: number; amount: number; contractId: number | null; claimId: number | null };
export type IncomingReportClaim = { id: number; contractId: number | null };

export function incomingPaymentRowsForReport(
  payments: Array<{ id: number; amount: number; paidAt: string; method: string; reference: string; contractId: number | null; claimId: number | null; clientId: number | null }>,
  claims: Array<{ id: number; ref: string; client: string; clientId: number | null; contract: string; contractId: number | null }>,
  contracts: Array<{ id: number; ref: string; client: string; clientId: number | null }>,
  clients: Array<{ id: number; name: string }>,
) {
  const claimById = new Map(claims.map(claim => [claim.id, claim]));
  const contractById = new Map(contracts.map(contract => [contract.id, contract]));
  const clientById = new Map(clients.map(client => [client.id, client.name]));
  return payments.map(payment => {
    const claim = payment.claimId === null ? undefined : claimById.get(payment.claimId);
    const contractId = payment.contractId ?? claim?.contractId ?? null;
    const contract = contractId === null ? undefined : contractById.get(contractId);
    const clientId = payment.clientId ?? claim?.clientId ?? contract?.clientId ?? null;
    return {
      id: payment.id,
      paidAt: payment.paidAt,
      clientId,
      client: clientId === null ? claim?.client ?? contract?.client ?? "—" : clientById.get(clientId) ?? claim?.client ?? contract?.client ?? "—",
      contract: contract?.ref ?? claim?.contract ?? "—",
      claim: claim?.ref ?? "—",
      amount: Number(payment.amount || 0),
      method: payment.method,
      reference: payment.reference,
    };
  });
}

export function groupIncomingPaymentsForReport(payments: IncomingReportPayment[], claims: IncomingReportClaim[]) {
  const contractByClaim = new Map(claims.map(claim => [claim.id, claim.contractId]));
  const byClaim = new Map<number, number>();
  const byContract = new Map<number, number>();
  for (const payment of payments) {
    if (payment.claimId !== null) byClaim.set(payment.claimId, (byClaim.get(payment.claimId) ?? 0) + Number(payment.amount || 0));
    const contractId = payment.contractId ?? (payment.claimId === null ? null : contractByClaim.get(payment.claimId) ?? null);
    if (contractId !== null) byContract.set(contractId, (byContract.get(contractId) ?? 0) + Number(payment.amount || 0));
  }
  return { byClaim, byContract };
}

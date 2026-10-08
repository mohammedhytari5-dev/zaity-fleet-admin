type Payment = { id: number; amount: number; contractId: number | null; claimId: number | null; clientId: number | null; paidAt?: string; method?: string; reference?: string };
type Claim = { id: number; contractId: number | null };
type Contract = { id: number; clientId: number | null; client?: string | null; ref?: string | null };
type ContractItem = { contractId: number; vehicleId: number | null };
type Vehicle = { id: number; contractId: number | null; projectId: number | null; project?: string | null; clientId: number | null; client?: string | null; plate?: string | null };
type Project = { id: number; contractId: number | null; name: string };
type Client = { id: number; name: string };
type ExistingAllocation = { paymentId: number; amount: number };

export type AutoLinkedVehicleRevenue = {
  id: number;
  vehicleId: number;
  paymentId: number;
  projectId: number | null;
  projectName: string;
  clientId: number | null;
  clientName: string;
  amount: number;
  receiptName: null;
  notes: string;
  createdByName: string;
  hasReceipt: false;
  autoLinked: true;
  paidAt: string;
  method: string;
  reference: string;
  contractRef: string;
  client: string;
};

/** Attribute the unallocated balance of a receipt to its vehicle when its contract has exactly one linked vehicle. */
export function deriveSingleVehicleAutoRevenues(input: {
  payments: Payment[];
  claims: Claim[];
  contracts: Contract[];
  contractItems: ContractItem[];
  vehicles: Vehicle[];
  projects: Project[];
  clients: Client[];
  allocations: ExistingAllocation[];
}): AutoLinkedVehicleRevenue[] {
  const claimsById = new Map(input.claims.map(row => [row.id, row]));
  const contractsById = new Map(input.contracts.map(row => [row.id, row]));
  const clientsById = new Map(input.clients.map(row => [row.id, row]));
  const allocationsByPayment = new Map<number, number>();
  for (const allocation of input.allocations) {
    allocationsByPayment.set(allocation.paymentId, (allocationsByPayment.get(allocation.paymentId) ?? 0) + Number(allocation.amount || 0));
  }

  const result: AutoLinkedVehicleRevenue[] = [];
  for (const payment of input.payments) {
    const contractId = payment.contractId ?? (payment.claimId ? claimsById.get(payment.claimId)?.contractId ?? null : null);
    if (!contractId) continue;
    const contract = contractsById.get(contractId);
    if (!contract) continue;
    const items = input.contractItems.filter(item => item.contractId === contractId);
    const linkedVehicleIds = Array.from(new Set(items.map(item => item.vehicleId).filter((id): id is number => id !== null)));
    const legacyVehicle = items.length === 0 ? input.vehicles.find(vehicle => vehicle.contractId === contractId) : undefined;
    const vehicleId = items.length > 0
      ? linkedVehicleIds.length === 1 ? linkedVehicleIds[0] : null
      : legacyVehicle?.id ?? null;
    if (vehicleId === null) continue;
    const vehicle = input.vehicles.find(row => row.id === vehicleId);
    if (!vehicle) continue;

    const amount = Math.max(0, Number(payment.amount || 0) - (allocationsByPayment.get(payment.id) ?? 0));
    if (amount === 0) continue;

    const project = input.projects.find(row => row.contractId === contractId);
    const legacyVehicleLink = vehicle.contractId === contractId;
    const projectId = project?.id ?? (legacyVehicleLink ? vehicle.projectId : null);
    const projectName = project?.name ?? (legacyVehicleLink ? vehicle.project : null) ?? "—";
    const clientId = payment.clientId ?? contract.clientId ?? (legacyVehicleLink ? vehicle.clientId : null);
    const clientName = (clientId ? clientsById.get(clientId)?.name : null) ?? contract.client ?? (legacyVehicleLink ? vehicle.client : null) ?? "—";

    result.push({
      id: -payment.id,
      vehicleId,
      paymentId: payment.id,
      projectId,
      projectName,
      clientId,
      clientName,
      amount,
      receiptName: null,
      notes: "دفعة مرتبطة تلقائيًا بعقد بباص واحد",
      createdByName: "تلقائي",
      hasReceipt: false,
      autoLinked: true,
      paidAt: payment.paidAt ?? "—",
      method: payment.method ?? "—",
      reference: payment.reference ?? "—",
      contractRef: contract.ref ?? "—",
      client: clientName,
    });
  }
  return result;
}

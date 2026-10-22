// Explicit demonstration data. None of these identities or bytes are Tide credentials.
export const simulationPeople = [
  { id: 'demo-forma', name: 'Alex · Forma Studio', organization: 'Forma Studio', context: 'Design contributor', roles: ['cobid-supplier-design', 'cobid-quote-design', '_tide_encryptor', '_tide_decryptor'] },
  { id: 'demo-software', name: 'Sam · Common Ground', organization: 'Common Ground', context: 'Software contributor', roles: ['cobid-supplier-software', 'cobid-quote-software', '_tide_encryptor', '_tide_decryptor'] },
  { id: 'demo-video', name: 'Kim · Frame by Frame', organization: 'Frame by Frame', context: 'Video contributor', roles: ['cobid-supplier-video', 'cobid-quote-video', '_tide_encryptor', '_tide_decryptor'] },
  { id: 'demo-buyer', name: 'Taylor · Buyer', organization: 'Demo university buyer', context: 'Buyer representative', roles: ['cobid-buyer', '_tide_decryptor'] },
  { id: 'demo-coordinator', name: 'Jordan · Coordinator', organization: 'Campus Collective', context: 'Coordinator · governance admin A', roles: ['cobid-coordinator', 'tide-realm-admin', '_tide_decryptor'] },
  { id: 'demo-admin-b', name: 'Morgan · Admin B', organization: 'Independent review', context: 'Governance admin B', roles: ['tide-realm-admin'] },
  { id: 'demo-admin-c', name: 'Casey · Admin C', organization: 'Independent review', context: 'Governance admin C', roles: ['tide-realm-admin'] },
];

export function encodeSimulationQuote(value, recordId) {
  const bytes = new TextEncoder().encode(JSON.stringify({ simulation: true, recordId, value }));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}

export function decodeSimulationQuote(ciphertext, recordId) {
  const bytes = Uint8Array.from(atob(ciphertext), char => char.charCodeAt(0));
  const envelope = JSON.parse(new TextDecoder().decode(bytes));
  if (envelope.simulation !== true || envelope.recordId !== recordId) throw new Error('This simulated quote belongs to another record.');
  return envelope.value;
}

export const simulationPolicy = supplier => btoa('COBID-SIMULATION-ONLY:policy:' + supplier);

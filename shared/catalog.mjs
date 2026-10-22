export const room = {
  id: 'rmit-sustainability-2026', title: 'RMIT Campus Sustainability Campaign',
  reference: 'RMIT / CREATIVE SERVICES / 026', buyer: 'RMIT University · Demo buyer',
  summary: 'One campus. A smaller footprint. Bring sustainable habits to life through a bold visual identity, an accessible digital experience, and stories that move students to act.',
  budget: '₫240–300M', deadline: '30 Oct 2026', duration: '6 weeks', location: 'Ho Chi Minh City',
};
export const suppliers = [
  { id: 'design', name: 'Forma Studio', short: 'FO', category: 'Brand & design', color: 'coral', role: 'cobid-supplier-design', tag: 'cobid_design', title: 'Campaign identity & design', description: 'A visual identity that makes everyday change feel possible.', deliverables: ['Campaign identity system', 'Social & print toolkit', 'Campus wayfinding concepts'], sample: { amount: 85000000, currency: 'VND', timeline: '3 weeks', note: 'Synthetic quote: includes two creative directions and two revision rounds. Internal production margin: 22%.' } },
  { id: 'software', name: 'Common Ground', short: 'CG', category: 'Digital experiences', color: 'mint', role: 'cobid-supplier-software', tag: 'cobid_software', title: 'Interactive campus experience', description: 'An accessible digital home for practical, measurable action.', deliverables: ['Responsive campaign microsite', 'Interactive impact calculator', 'Analytics & accessibility review'], sample: { amount: 120000000, currency: 'VND', timeline: '5 weeks', note: 'Synthetic quote: includes a six-week support window. Internal subcontractor allowance: VND 18,000,000.' } },
  { id: 'video', name: 'Frame by Frame', short: 'FF', category: 'Film & storytelling', color: 'lavender', role: 'cobid-supplier-video', tag: 'cobid_video', title: 'Stories from a greener campus', description: 'Student-led stories, crafted to turn attention into action.', deliverables: ['60-second campaign film', 'Three student story cutdowns', 'Captioned social edits'], sample: { amount: 75000000, currency: 'VND', timeline: '4 weeks', note: 'Synthetic quote: two on-campus shoot days. Internal equipment allowance: VND 9,000,000.' } },
];
export const membershipRoles = ['cobid-coordinator', 'cobid-buyer', ...suppliers.map(s => s.role)];
export const supplierById = id => suppliers.find(s => s.id === id);
export const encryptRole = tag => `_tide_${tag}.selfencrypt`;
export const decryptRole = tag => `_tide_${tag}.selfdecrypt`;

import { kesehatanBPJSPolicies } from "./kesehatanBPJS";
import { lemburKompensasiPolicies } from "./lemburKompensasi";
import { cutiAbsensiPolicies } from "./cutiAbsensi";
import { kodeEtikPolicies } from "./kodeEtik";
import { formulirLinkPolicies } from "./formulirLink";
import { informasiPengumumanPolicies } from "./informasiPengumuman";
import { discordWorkflowPolicies } from "./discordWorkflow";
import { notionTaskManagementPolicies } from "./notionTaskManagement";
import { jadwalMeetingWajibPolicies } from "./jadwalMeetingWajib";
import { jenisPerlangaranPolicies } from "./jenisPerlanggaran";
import { sistemSanksiPolicies } from "./sistemSanksi";
import { kpiPolicies } from "./kpi";
import { profilPerusahaanPolicies } from "./profilPerusahaan";

// Gabungkan semua policies
export const allPolicies = [
  ...kesehatanBPJSPolicies,
  ...lemburKompensasiPolicies,
  ...cutiAbsensiPolicies,
  ...kodeEtikPolicies,
  ...formulirLinkPolicies,
  ...informasiPengumumanPolicies,
  ...discordWorkflowPolicies,
  ...notionTaskManagementPolicies,
  ...jadwalMeetingWajibPolicies,
  ...jenisPerlangaranPolicies,
  ...sistemSanksiPolicies,
  ...kpiPolicies,
  ...profilPerusahaanPolicies,
];

// Export individual categories
export {
  kesehatanBPJSPolicies,
  lemburKompensasiPolicies,
  cutiAbsensiPolicies,
  kodeEtikPolicies,
  formulirLinkPolicies,
  informasiPengumumanPolicies,
  discordWorkflowPolicies,
  notionTaskManagementPolicies,
  jadwalMeetingWajibPolicies,
  jenisPerlangaranPolicies,
  sistemSanksiPolicies,
  kpiPolicies,
  profilPerusahaanPolicies,
};

// Helper: Get policies by category
export const getPoliciesByCategory = (categoryName) => {
  if (categoryName === "Semua") {
    return allPolicies;
  }
  return allPolicies.filter((policy) => policy.category === categoryName);
};

// Helper: Get unique categories
export const getCategories = () => {
  const categoryOrder = [
    "Semua",
    "Profil Perusahaan",
    "Informasi & Pengumuman",
    "Aturan Disiplin",
    "Kode Etik",
    "Cuti & Absensi",
    "Lembur & Kompensasi",
    "Kesehatan & BPJS",
    "Pengembangan Diri",
    "Formulir & Link",
  ];
  return categoryOrder;
};

// Helper: Get policy by ID
export const getPolicyById = (id) => {
  return allPolicies.find((policy) => policy.id === id);
};

// Helper: Search policies
export const searchPolicies = (query) => {
  const q = query.toLowerCase();
  return allPolicies.filter(
    (p) =>
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)) ||
      p.content.toLowerCase().includes(q)
  );
};

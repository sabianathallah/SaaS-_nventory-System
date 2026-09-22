import { 
  LayoutGrid, 
  Heart, 
  Clock, 
  Calendar, 
  Shield,
  Link,
  Info,
  AlertTriangle,
  Building2,
  Zap
} from "lucide-react";

// Category icons using Lucide (premium icons)
export const categoryIcons = {
  "Semua": LayoutGrid,
  "Kesehatan & BPJS": Heart,
  "Lembur & Kompensasi": Clock,
  "Cuti & Absensi": Calendar,
  "Kode Etik": Shield,
  "Formulir & Link": Link,
  "Informasi & Pengumuman": Info,
  "Aturan Disiplin": AlertTriangle,
  "Pengembangan Diri": Zap,
  "Profil Perusahaan": Building2,
};

// Category colors (PREFACE Red theme)
export const categoryColors = {
  "Kesehatan & BPJS": "#C8102E",    // PREFACE Red
  "Lembur & Kompensasi": "#C8102E", // PREFACE Red
  "Cuti & Absensi": "#C8102E",      // PREFACE Red
  "Kode Etik": "#C8102E",           // PREFACE Red
  "Formulir & Link": "#C8102E",     // PREFACE Red
  "Informasi & Pengumuman": "#C8102E", // PREFACE Red
  "Aturan Disiplin": "#C8102E",     // PREFACE Red
  "Pengembangan Diri": "#8b5cf6",   // Purple
  "Profil Perusahaan": "#8b5cf6",   // Purple
};

export const getCategoryIcon = (categoryName) => {
  return categoryIcons[categoryName] || LayoutGrid;
};

export const getCategoryColor = (categoryName) => {
  return categoryColors[categoryName] || "#C8102E";
};

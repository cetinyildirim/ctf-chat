import { LegalDocument } from '@/components/legal/LegalDocument';
import { aupTrFooter, aupTrIntro, aupTrMeta, aupTrSections } from '@/content/legal/aup-tr';

export const metadata = {
  title: 'Kullanım Kuralları · SYDT Chat',
  description: 'SYDT Chat platformunun kullanım kuralları, yarışma dürüstlüğü ve moderasyon ilkeleri.',
};

export default function AcceptableUsePolicyTrPage() {
  return (
    <LegalDocument
      title={aupTrMeta.title}
      updated={aupTrMeta.updated}
      intro={aupTrIntro}
      sections={aupTrSections}
      footer={aupTrFooter}
      backHref="/"
      backLabel="Ana sayfaya dön"
      tocLabel="İçindekiler"
    />
  );
}

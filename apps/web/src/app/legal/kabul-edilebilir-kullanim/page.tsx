import { LegalDocument } from '@/components/legal/LegalDocument';
import { aupTrFooter, aupTrIntro, aupTrMeta, aupTrSections } from '@/content/legal/aup-tr';

export const metadata = {
  title: 'Kabul Edilebilir Kullanım Politikası · SYDT',
  description: 'SYDT Chat platformu kabul edilebilir kullanım ve topluluk kuralları.',
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
    />
  );
}

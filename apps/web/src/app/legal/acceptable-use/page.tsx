import { LegalDocument } from '@/components/legal/LegalDocument';
import { aupEnFooter, aupEnIntro, aupEnMeta, aupEnSections } from '@/content/legal/aup-en';

export const metadata = {
  title: 'Acceptable Use Policy · SYDT',
  description: 'SYDT Chat acceptable use and community guidelines.',
};

export default function AcceptableUsePolicyEnPage() {
  return (
    <LegalDocument
      title={aupEnMeta.title}
      updated={aupEnMeta.updated}
      intro={aupEnIntro}
      sections={aupEnSections}
      footer={aupEnFooter}
      backHref="/"
      backLabel="Back to home"
    />
  );
}

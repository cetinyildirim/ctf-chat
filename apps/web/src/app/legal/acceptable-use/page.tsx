import { LegalDocument } from '@/components/legal/LegalDocument';
import { aupEnFooter, aupEnIntro, aupEnMeta, aupEnSections } from '@/content/legal/aup-en';

export const metadata = {
  title: 'Rules of Use · SYDT Chat',
  description: 'SYDT Chat rules of use, competition integrity and moderation principles.',
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
      tocLabel="Contents"
    />
  );
}

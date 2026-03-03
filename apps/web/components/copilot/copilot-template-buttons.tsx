'use client';

import { buttonVariants } from '@/components/ui/button';

type CopilotTemplateButtonsProps = {
  onTemplateSelect: (
    template: 'summarize_case' | 'draft_response' | 'extract_timeline' | 'hearing_plan',
    message: string,
  ) => void;
  disabled?: boolean;
};

const TEMPLATE_ACTIONS: Array<{
  template: 'summarize_case' | 'draft_response' | 'extract_timeline' | 'hearing_plan';
  label: string;
  message: string;
}> = [
  {
    template: 'summarize_case',
    label: 'تلخيص القضية',
    message: 'لخص القضية الحالية في نقاط واضحة تشمل الوقائع الأساسية والموقف الإجرائي الحالي.',
  },
  {
    template: 'draft_response',
    label: 'صياغة رد',
    message: 'أنشئ مسودة رد قانوني مهني بالاعتماد على مستندات القضية الحالية مع إبراز نقاط القوة.',
  },
  {
    template: 'extract_timeline',
    label: 'استخراج خط زمني',
    message: 'استخرج جدولًا زمنيًا للقضية مع التواريخ والأحداث والمستندات المرجعية الداعمة.',
  },
  {
    template: 'hearing_plan',
    label: 'خطة جلسة',
    message: 'جهّز خطة جلسة: النقاط التي يجب عرضها، المستندات المطلوبة، والأسئلة المقترحة.',
  },
];

export function CopilotTemplateButtons({ onTemplateSelect, disabled = false }: CopilotTemplateButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {TEMPLATE_ACTIONS.map((action) => (
        <button
          key={action.template}
          type="button"
          disabled={disabled}
          className={buttonVariants('outline', 'sm')}
          onClick={() => onTemplateSelect(action.template, action.message)}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

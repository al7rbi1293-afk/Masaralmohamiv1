import { redirect } from 'next/navigation';

type TenantRootPageProps = {
  params: {
    tenantId: string;
  };
};

export default function TenantRootPage({ params }: TenantRootPageProps) {
  redirect(`/app/${params.tenantId}/dashboard`);
}

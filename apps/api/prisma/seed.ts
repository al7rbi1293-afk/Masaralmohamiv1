import {
  Language,
  MatterStatus,
  PrismaClient,
  QuoteStatus,
  Role,
  TaskStatus,
  InvoiceStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const demoTenantId = '11111111-1111-4111-8111-111111111111';
  const partnerId = '22222222-2222-4222-8222-222222222222';
  const lawyerId = '33333333-3333-4333-8333-333333333333';
  const assistantId = '44444444-4444-4444-8444-444444444444';
  const clientId = '55555555-5555-4555-8555-555555555555';
  const matterId = '66666666-6666-4666-8666-666666666666';

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const tenant = await prisma.tenant.upsert({
    where: { id: demoTenantId },
    update: {
      firmName: 'مكتب سجل للمحاماة',
      language: Language.AR,
      hijriDisplay: true,
      retentionDays: 3650,
    },
    create: {
      id: demoTenantId,
      firmName: 'مكتب سجل للمحاماة',
      language: Language.AR,
      hijriDisplay: true,
      retentionDays: 3650,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'partner@sijil.sa',
      },
    },
    update: {
      id: partnerId,
      name: 'سارة الشمري',
      passwordHash,
      role: Role.PARTNER,
      isActive: true,
    },
    create: {
      id: partnerId,
      tenantId: tenant.id,
      name: 'سارة الشمري',
      email: 'partner@sijil.sa',
      passwordHash,
      role: Role.PARTNER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'lawyer@sijil.sa',
      },
    },
    update: {
      id: lawyerId,
      name: 'محمد العتيبي',
      passwordHash,
      role: Role.LAWYER,
      isActive: true,
    },
    create: {
      id: lawyerId,
      tenantId: tenant.id,
      name: 'محمد العتيبي',
      email: 'lawyer@sijil.sa',
      passwordHash,
      role: Role.LAWYER,
      isActive: true,
    },
  });

  await prisma.user.upsert({
    where: {
      tenantId_email: {
        tenantId: tenant.id,
        email: 'assistant@sijil.sa',
      },
    },
    update: {
      id: assistantId,
      name: 'نورة الدوسري',
      passwordHash,
      role: Role.ASSISTANT,
      isActive: true,
    },
    create: {
      id: assistantId,
      tenantId: tenant.id,
      name: 'نورة الدوسري',
      email: 'assistant@sijil.sa',
      passwordHash,
      role: Role.ASSISTANT,
      isActive: true,
    },
  });

  await prisma.client.upsert({
    where: { id: clientId },
    update: {
      tenantId: tenant.id,
      name: 'شركة الأفق التجارية',
      email: 'legal@alofuq.sa',
      phone: '+966500000001',
      notes: 'عميل استراتيجي',
      isArchived: false,
    },
    create: {
      id: clientId,
      tenantId: tenant.id,
      name: 'شركة الأفق التجارية',
      email: 'legal@alofuq.sa',
      phone: '+966500000001',
      notes: 'عميل استراتيجي',
    },
  });

  const matter = await prisma.matter.upsert({
    where: { id: matterId },
    update: {
      tenantId: tenant.id,
      clientId,
      title: 'نزاع تجاري - مطالبة مالية',
      description: 'متابعة دعوى تجارية في المحكمة التجارية بالرياض',
      status: MatterStatus.IN_PROGRESS,
      assigneeId: lawyerId,
      isPrivate: false,
    },
    create: {
      id: matterId,
      tenantId: tenant.id,
      clientId,
      title: 'نزاع تجاري - مطالبة مالية',
      description: 'متابعة دعوى تجارية في المحكمة التجارية بالرياض',
      status: MatterStatus.IN_PROGRESS,
      assigneeId: lawyerId,
      isPrivate: false,
    },
  });

  await prisma.matterMember.createMany({
    data: [
      {
        tenantId: tenant.id,
        matterId: matter.id,
        userId: partnerId,
      },
      {
        tenantId: tenant.id,
        matterId: matter.id,
        userId: lawyerId,
      },
    ],
    skipDuplicates: true,
  });

  const timelineCount = await prisma.matterTimelineEvent.count({
    where: {
      tenantId: tenant.id,
      matterId: matter.id,
      type: 'MATTER_CREATED',
    },
  });

  if (timelineCount === 0) {
    await prisma.matterTimelineEvent.createMany({
      data: [
        {
          tenantId: tenant.id,
          matterId: matter.id,
          actorId: partnerId,
          type: 'MATTER_CREATED',
          payload: { note: 'تم فتح القضية' },
        },
        {
          tenantId: tenant.id,
          matterId: matter.id,
          actorId: lawyerId,
          type: 'HEARING_SCHEDULED',
          payload: { hearingDate: new Date().toISOString() },
        },
      ],
    });
  }

  const existingTasks = await prisma.task.count({
    where: { tenantId: tenant.id, matterId: matter.id },
  });

  if (existingTasks === 0) {
    await prisma.task.createMany({
      data: [
        {
          tenantId: tenant.id,
          title: 'تحضير مذكرة الرد',
          description: 'إعداد مذكرة خلال 48 ساعة',
          status: TaskStatus.TODO,
          dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          reminderAt: new Date(Date.now() + 12 * 60 * 60 * 1000),
          assigneeId: lawyerId,
          matterId: matter.id,
          createdById: partnerId,
        },
        {
          tenantId: tenant.id,
          title: 'إرسال طلب مستندات للعميل',
          status: TaskStatus.IN_PROGRESS,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
          assigneeId: assistantId,
          matterId: matter.id,
          createdById: lawyerId,
        },
      ],
    });
  }

  const quote = await prisma.billingQuote.upsert({
    where: {
      tenantId_number: {
        tenantId: tenant.id,
        number: 'Q-2026-0001',
      },
    },
    update: {
      clientId,
      matterId: matter.id,
      status: QuoteStatus.SENT,
      subtotal: '5000.00',
      tax: '750.00',
      total: '5750.00',
      createdById: partnerId,
    },
    create: {
      tenantId: tenant.id,
      clientId,
      matterId: matter.id,
      number: 'Q-2026-0001',
      status: QuoteStatus.SENT,
      subtotal: '5000.00',
      tax: '750.00',
      total: '5750.00',
      createdById: partnerId,
    },
  });

  await prisma.invoice.upsert({
    where: {
      tenantId_number: {
        tenantId: tenant.id,
        number: 'INV-2026-0001',
      },
    },
    update: {
      clientId,
      matterId: matter.id,
      quoteId: quote.id,
      status: InvoiceStatus.UNPAID,
      subtotal: '5000.00',
      tax: '750.00',
      total: '5750.00',
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      createdById: partnerId,
    },
    create: {
      tenantId: tenant.id,
      clientId,
      matterId: matter.id,
      quoteId: quote.id,
      number: 'INV-2026-0001',
      status: InvoiceStatus.UNPAID,
      issuedAt: new Date(),
      dueAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      subtotal: '5000.00',
      tax: '750.00',
      total: '5750.00',
      createdById: partnerId,
    },
  });

  let folder = await prisma.documentFolder.findFirst({
    where: {
      tenantId: tenant.id,
      name: 'عقود',
      parentId: null,
    },
  });

  if (!folder) {
    folder = await prisma.documentFolder.create({
      data: {
        tenantId: tenant.id,
        name: 'عقود',
      },
    });
  }

  let document = await prisma.document.findFirst({
    where: {
      tenantId: tenant.id,
      title: 'عقد شراكة',
      matterId: matter.id,
    },
  });

  if (!document) {
    document = await prisma.document.create({
      data: {
        tenantId: tenant.id,
        matterId: matter.id,
        clientId,
        folderId: folder.id,
        title: 'عقد شراكة',
        createdById: lawyerId,
      },
    });
  }

  await prisma.documentVersion.upsert({
    where: {
      tenantId_documentId_version: {
        tenantId: tenant.id,
        documentId: document.id,
        version: 1,
      },
    },
    update: {
      storageKey: `tenants/${tenant.id}/documents/${document.id}/v1.pdf`,
      mimeType: 'application/pdf',
      size: 1048576,
      tags: ['contract', 'partnership'],
      uploadedById: lawyerId,
    },
    create: {
      tenantId: tenant.id,
      documentId: document.id,
      version: 1,
      storageKey: `tenants/${tenant.id}/documents/${document.id}/v1.pdf`,
      mimeType: 'application/pdf',
      size: 1048576,
      tags: ['contract', 'partnership'],
      uploadedById: lawyerId,
    },
  });

  const auditExists = await prisma.auditLog.count({
    where: {
      tenantId: tenant.id,
      action: 'SEED_DATA_CREATED',
      entity: 'system',
    },
  });

  if (auditExists === 0) {
    await prisma.auditLog.createMany({
      data: [
        {
          tenantId: tenant.id,
          userId: partnerId,
          action: 'LOGIN_SUCCESS',
          entity: 'auth',
          metadata: { email: 'partner@sijil.sa' },
        },
        {
          tenantId: tenant.id,
          userId: partnerId,
          action: 'SEED_DATA_CREATED',
          entity: 'system',
        },
      ],
    });
  }

  console.log('Seed complete.');
  console.log('Demo tenant:', demoTenantId);
  console.log('Partner login: partner@sijil.sa / Password123!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { Response, NextFunction } from 'express';
import { z } from 'zod';
import { parse } from 'csv-parse/sync';
import prisma from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const contactSchema = z.object({
  name: z.string().min(1).max(200),
  mobile: z.string().min(7).max(20),
  tags: z.array(z.string()).default([]),
  leadStage: z.enum(['LEAD', 'PROSPECT', 'QUALIFIED', 'CUSTOMER', 'CHURNED', 'VIP']).default('LEAD'),
  city: z.string().optional(),
  notes: z.string().optional(),
  email: z.string().email().optional(),
  birthday: z.string().datetime().optional(),
  anniversary: z.string().datetime().optional(),
});

export const listContacts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { businessAccountId } = req;
    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '20');
    const search = req.query.search as string;
    const leadStage = req.query.leadStage as string;
    const tag = req.query.tag as string;

    const where: Record<string, unknown> = { businessAccountId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (leadStage) where.leadStage = leadStage;
    if (tag) where.tags = { has: tag };

    const [contacts, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          _count: { select: { statuses: true, aiReplies: true } },
        },
      }),
      prisma.contact.count({ where }),
    ]);

    res.json({
      success: true,
      data: contacts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
};

export const getContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
      include: {
        statuses: { orderBy: { timestamp: 'desc' }, take: 10 },
        aiReplies: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { status: true },
        },
        engagementLogs: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!contact) throw new AppError('Contact not found', 404);

    res.json({ success: true, data: contact });
  } catch (err) {
    next(err);
  }
};

export const createContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = contactSchema.parse(req.body);

    const contact = await prisma.contact.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        tags: data.tags,
        leadStage: data.leadStage,
        city: data.city,
        notes: data.notes,
        email: data.email,
        birthday: data.birthday ? new Date(data.birthday) : undefined,
        anniversary: data.anniversary ? new Date(data.anniversary) : undefined,
        businessAccount: {
          connect: {
            id: req.businessAccountId!
          }
        }
      },
    });

    res.status(201).json({ success: true, data: contact });
  } catch (err) {
    if ((err as { code?: string }).code === 'P2002') {
      next(new AppError('Contact with this mobile number already exists', 409));
    } else {
      next(err);
    }
  }
};

export const updateContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const data = contactSchema.partial().parse(req.body);

    const existing = await prisma.contact.findFirst({
      where: {
        id: req.params.id,
        businessAccountId: req.businessAccountId,
      },
    });

    if (!existing) {
      throw new AppError('Contact not found', 404);
    }

    const updated = await prisma.contact.update({
      where: {
        id: req.params.id,
      },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.mobile && { mobile: data.mobile }),
        ...(data.tags && { tags: data.tags }),
        ...(data.leadStage && { leadStage: data.leadStage }),
        ...(data.city !== undefined && { city: data.city }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.birthday && { birthday: new Date(data.birthday) }),
        ...(data.anniversary && { anniversary: new Date(data.anniversary) }),
      },
    });

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteContact = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const result = await prisma.contact.deleteMany({
      where: { id: req.params.id, businessAccountId: req.businessAccountId },
    });

    if (result.count === 0) throw new AppError('Contact not found', 404);

    res.json({ success: true, message: 'Contact deleted' });
  } catch (err) {
    next(err);
  }
};

export const importContacts = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) throw new AppError('CSV file required', 400);

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const record of records) {
      try {
        const contactData = {
          name: record.name || record.Name,
          mobile: record.mobile || record.Mobile || record.phone || record.Phone,
          tags: record.tags ? record.tags.split(',').map((t: string) => t.trim()) : [],
          leadStage: (record.leadStage || record.lead_stage || 'LEAD') as never,
          city: record.city || record.City,
          notes: record.notes || record.Notes,
          email: record.email || record.Email,
        };

        if (!contactData.name || !contactData.mobile) {
          results.errors.push(`Row missing name or mobile: ${JSON.stringify(record)}`);
          results.skipped++;
          continue;
        }

        await prisma.contact.upsert({
          where: {
            businessAccountId_mobile: {
              businessAccountId: req.businessAccountId!,
              mobile: contactData.mobile,
            },
          },
          create: {
            name: contactData.name!,
            mobile: contactData.mobile!,
            tags: contactData.tags || [],
            leadStage: contactData.leadStage || 'LEAD',
            city: contactData.city,
            notes: contactData.notes,
            email: contactData.email,
            businessAccount: {
              connect: {
                id: req.businessAccountId!
              }
            }
          },
          update: { name: contactData.name, tags: contactData.tags },
        });

        results.created++;
      } catch (err) {
        logger.error('CSV import row error:', err);
        results.skipped++;
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};

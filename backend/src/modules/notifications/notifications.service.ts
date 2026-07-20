import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/prisma/prisma.service';
import { NotificationType } from '@prisma/client';
import * as nodemailer from 'nodemailer';

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, any>;
}

export interface PaginationOptions {
  page?: number;
  limit?: number;
}

@Injectable()
export class NotificationsService {
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT'),
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  async createNotification(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    metadata?: Record<string, any>,
  ) {
    // Verify user exists
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata,
      },
    });
  }

  async sendEmailNotification(
    to: string,
    subject: string,
    htmlBody: string,
  ): Promise<void> {
    try {
      const mailOptions = {
        from: this.configService.get<string>('MAIL_FROM'),
        to,
        subject,
        html: htmlBody,
      };

      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error sending email notification:', error);
      throw new BadRequestException('Failed to send email notification');
    }
  }

  async getNotificationsByUser(
    userId: string,
    pagination?: PaginationOptions,
    onlyUnread?: boolean,
  ) {
    const page = pagination?.page || 1;
    const limit = pagination?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (onlyUnread) {
      where.isRead = false;
    }

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data: notifications,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new BadRequestException('Cannot mark another user notification as read');
    }

    return this.prisma.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: {
        userId,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  }

  async markNotificationsByTitle(userId: string, title: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        userId,
        title,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
    return result;
  }

  async deleteNotification(notificationId: string, userId: string) {
    const notif = await this.prisma.notification.findUnique({ where: { id: notificationId } });
    if (!notif) throw new NotFoundException('Notification not found');
    if (notif.userId !== userId) throw new BadRequestException('Cannot delete another user notification');
    return this.prisma.notification.delete({ where: { id: notificationId } });
  }

  async deleteAllNotifications(userId: string) {
    const result = await this.prisma.notification.deleteMany({ where: { userId } });
    return result;
  }

  async notifyDocumentUploaded(
    processId: string,
    documentName: string,
  ): Promise<void> {
    const process = await this.prisma.degreeProcess.findUnique({
      where: { id: processId },
      include: {
        student: true,
        advisor: true,
      },
    });

    if (!process) {
      throw new NotFoundException('Degree process not found');
    }

    // Notify advisor
    if (process.advisor) {
      await this.createNotification(
        process.advisor.id,
        NotificationType.DOCUMENT_UPLOADED,
        'Document Uploaded',
        `Student has uploaded document: ${documentName}`,
        { processId, documentName },
      );
    }

    // Notify secretary (get from system - usually there's a secretary role)
    // This would need adjustment based on how secretaries are determined in the system
  }

  async notifyReviewRequested(
    processId: string,
    advisorUserId: string,
    documentName: string,
  ): Promise<void> {
    await this.createNotification(
      advisorUserId,
      NotificationType.REVIEW_REQUESTED,
      'Review Requested',
      `Document review requested: ${documentName}`,
      { processId, documentName },
    );
  }

  async notifyApprovalGranted(
    processId: string,
    studentUserId: string,
    documentName: string,
  ): Promise<void> {
    await this.createNotification(
      studentUserId,
      NotificationType.APPROVAL_GRANTED,
      'Document Approved',
      `Your document has been approved: ${documentName}`,
      { processId, documentName },
    );
  }

  async notifyRevisionRequired(
    processId: string,
    studentUserId: string,
    documentName: string,
    observations: string,
  ): Promise<void> {
    await this.createNotification(
      studentUserId,
      NotificationType.REVISION_REQUIRED,
      'Revision Required',
      `Please revise document: ${documentName}. Observations: ${observations}`,
      { processId, documentName, observations },
    );
  }

  async notifyProcessCompleted(processId: string, studentUserId: string): Promise<void> {
    await this.createNotification(
      studentUserId,
      NotificationType.PROCESS_COMPLETED,
      'Process Completed',
      'Your degree process has been completed',
      { processId },
    );
  }

  async notifySignatureApplied(
    processId: string,
    studentUserId: string,
    documentName: string,
  ): Promise<void> {
    await this.createNotification(
      studentUserId,
      NotificationType.SIGNATURE_APPLIED,
      'Document Signed',
      `Digital signature applied to: ${documentName}`,
      { processId, documentName },
    );
  }
}

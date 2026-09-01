import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import archiver from 'archiver';

import * as QRCode from 'qrcode';
import { Response } from 'express';

@Injectable()
export class GuestsService {
  constructor(@InjectModel('Guest') private guestModel: Model<any>) {}

  generateToken() {
    return randomBytes(10).toString('hex');
  }

  async createGuest(name: string, ticketType: string = 'Standard') {
    const token = this.generateToken();
    return this.guestModel.create({ name, ticketType, token });
  }

  /**
   * Read-only preview for attendees scanning their pass with a personal phone browser
   */
  async getPassDetails(token: string) {
    const guest = await this.guestModel.findOne({ token });

    if (!guest) {
      throw new NotFoundException('Invalid QR code access pass');
    }

    return {
      success: true,
      valid: !guest.used,
      claimed: guest.used,
      message: guest.used
        ? `Pass Already Claimed & Checked In on ${guest.usedAt ? new Date(guest.usedAt).toLocaleString() : 'earlier'}`
        : 'Pass Valid For Gate Check-In',
      name: guest.name || `Attendee #${guest.sequence}`,
      sequence: guest.sequence,
      ticketType: guest.ticketType || 'Standard',
      used: guest.used,
      usedAt: guest.usedAt,
      guest: {
        name: guest.name || `Attendee #${guest.sequence}`,
        sequence: guest.sequence,
        ticketType: guest.ticketType || 'Standard',
        used: guest.used,
        usedAt: guest.usedAt,
      },
    };
  }

  /**
   * Official Check-In Action performed by Event Staff / Mobile Scanner App
   */
  async checkInPass(token: string) {
    const guest = await this.guestModel.findOne({ token });

    if (!guest) {
      throw new UnauthorizedException('Invalid QR code access pass');
    }

    if (guest.used) {
      throw new ForbiddenException(
        `Pass REVOKED: This pass was already scanned & claimed on ${guest.usedAt ? new Date(guest.usedAt).toLocaleString() : 'an earlier check-in'}.`
      );
    }

    guest.used = true;
    guest.usedAt = new Date();
    guest.scanTime = new Date();
    await guest.save();

    return {
      success: true,
      message: 'Access pass checked-in successfully',
      guest: {
        name: guest.name || `Attendee #${guest.sequence}`,
        sequence: guest.sequence,
        ticketType: guest.ticketType || 'Standard',
        usedAt: guest.usedAt,
      },
      name: guest.name || `Attendee #${guest.sequence}`,
      sequence: guest.sequence,
      ticketType: guest.ticketType || 'Standard',
    };
  }

  async findAll() {
    return this.guestModel.find().sort({ sequence: 1 });
  }

  async bulkCreate(count: number, ticketType: string = 'Standard') {
    const last: any = await this.guestModel.findOne().sort({ sequence: -1 }).lean();

    let start = last?.sequence || 0;

    const guests = Array.from({ length: count }).map((_, i) => ({
      sequence: start + i + 1,
      ticketType: ticketType || 'Standard',
      token: this.generateToken(),
    }));

    await this.guestModel.insertMany(guests);

    return { success: true, created: count };
  }

  async downloadZip(res: Response) {
    const guests = await this.guestModel.find().sort({ sequence: 1 }).lean();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="app_launch_access_passes.zip"',
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      const number = String(g.sequence || i + 1).padStart(4, '0');

      const targetHost = process.env.HOST_IP || '192.168.0.108';
      const qrBuffer = await QRCode.toBuffer(
        `http://${targetHost}:5173/guests/verify/${g.token}`,
        {
          width: 600,
          margin: 2,
          color: {
            dark: '#0f172a',
            light: '#ffffff',
          },
        },
      );

      archive.append(qrBuffer, { name: `Pass_${number}_${g.ticketType || 'Standard'}.png` });
    }

    await archive.finalize();
  }
  async findUsedGuests() {
    return this.guestModel
      .find({ used: true })
      .sort({ scanTime: 1 }) // earliest scans first
      .lean();
  }

  async resetGuestUsedStatus(id: string) {
    if (!mongoose.isValidObjectId(id)) {
      throw new BadRequestException('Invalid guest ID format');
    }

    const guest: any = await this.guestModel.findByIdAndUpdate(
      id,
      {
        $set: {
          used: false,
          usedAt: null,
        },
      },
      { new: true, lean: true },
    );

    if (!guest) {
      throw new NotFoundException(`Guest with ID ${id} not found`);
    }

    return {
      success: true,
      message: 'Guest reset successfully',
      guest: {
        id: guest._id,
        sequence: guest.sequence,
        name: guest.name || 'Unnamed',
        used: guest.used,
      },
    };
  }

  /**
   * Reset ALL guests' used status to false
   */
  async resetAllGuestsUsedStatus() {
    const result = await this.guestModel.updateMany(
      { used: true }, // only update those who were used (faster)
      {
        $set: {
          used: false,
          usedAt: null,
        },
      },
    );

    return {
      success: true,
      message: 'All guests have been reset to unused',
      resetCount: result.modifiedCount,
      totalAffected: result.modifiedCount, // same in this case
    };
  }
}

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

  async createGuest(name: string) {
    const token = this.generateToken();
    return this.guestModel.create({ name, token });
  }

  async verifyToken(token: string) {
    const guest = await this.guestModel.findOne({ token });

    if (!guest) {
      throw new UnauthorizedException('Invalid QR code');
    }

    if (guest.used) {
      throw new ForbiddenException('QR code already used');
    }

    guest.used = true;
    guest.usedAt = new Date();
    await guest.save();

    return {
      success: true,
      name: guest.name,
      sequence: guest.sequence,
    };
  }

  async findAll() {
    return this.guestModel.find();
  }
  async bulkCreate(count: number) {
    const last = await this.guestModel.findOne().sort({ sequence: -1 }).lean();

    let start = last?.sequence || 0;

    const guests = Array.from({ length: count }).map((_, i) => ({
      sequence: start + i + 1,
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
      'attachment; filename="wedding_qr_codes.zip"',
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < guests.length; i++) {
      const g = guests[i];
      const number = String(g.sequence || i + 1).padStart(3, '0');

      const qrBuffer = await QRCode.toBuffer(
        `http://196.190.251.148:1234/guests/verify/${g.token}`,
        {
          width: 500,
          margin: 2,
          color: {
            dark: '#8b5e3c',
            light: '#ffffff',
          },
        },
      );

      archive.append(qrBuffer, { name: `${number}.png` });
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

    const guest = await this.guestModel.findByIdAndUpdate(
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

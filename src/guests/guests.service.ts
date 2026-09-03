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

import { RegisterGuestDto } from './dto/register-guest.dto';

export const GUEST_ROLES = [
  'Carrier',
  'Shipper',
  'Broker',
  'Government Official',
  'Other',
];

@Injectable()
export class GuestsService {
  constructor(@InjectModel('Guest') private guestModel: Model<any>) {}

  generateToken() {
    return randomBytes(10).toString('hex');
  }

  /**
   * Next free pass number, so self-registered guests keep the same
   * numbering as the bulk-generated printed passes
   */
  async nextSequence() {
    const last: any = await this.guestModel.findOne().sort({ sequence: -1 }).lean();
    return (last?.sequence || 0) + 1;
  }

  /**
   * Validates + trims the details an attendee types on their phone
   * after scanning their pass
   */
  private cleanDetails(dto: RegisterGuestDto) {
    const name = (dto?.name || '').trim();
    const phone = (dto?.phone || '').trim();
    const role = (dto?.role || '').trim();
    const company = (dto?.company || '').trim();

    if (name.length < 2) {
      throw new BadRequestException('Please enter your full name');
    }

    if (!/^[+\d][\d\s()-]{5,}$/.test(phone)) {
      throw new BadRequestException('Please enter a valid phone number');
    }

    if (!GUEST_ROLES.includes(role)) {
      throw new BadRequestException(
        `Please choose what you are joining as (${GUEST_ROLES.join(', ')})`,
      );
    }

    return { name, phone, role, company };
  }

  async createGuest(name: string, ticketType: string = 'Standard') {
    const token = this.generateToken();
    return this.guestModel.create({ name, ticketType, token });
  }

  /**
   * Self-registration for a walk-up attendee who has no printed pass yet:
   * creates the guest from the details they typed and hands back the token
   * their pass lives on
   */
  async selfRegister(dto: RegisterGuestDto, ticketType: string = 'Standard') {
    const details = this.cleanDetails(dto);

    const guest: any = await this.guestModel.create({
      ...details,
      ticketType: ticketType || 'Standard',
      sequence: await this.nextSequence(),
      token: this.generateToken(),
      registeredAt: new Date(),
    });

    return {
      success: true,
      message: 'Guest pass reserved successfully',
      token: guest.token,
      guest: this.toPassPayload(guest),
    };
  }

  /**
   * Attaches the attendee's details to a pre-printed pass they just scanned
   */
  async registerGuest(token: string, dto: RegisterGuestDto) {
    const details = this.cleanDetails(dto);

    const guest: any = await this.guestModel.findOne({ token });

    if (!guest) {
      throw new NotFoundException('Invalid QR code access pass');
    }

    if (guest.used) {
      throw new ForbiddenException(
        'This pass has already been checked in and can no longer be edited',
      );
    }

    guest.name = details.name;
    guest.phone = details.phone;
    guest.role = details.role;
    guest.company = details.company;
    guest.registeredAt = guest.registeredAt || new Date();
    await guest.save();

    return {
      success: true,
      message: 'Guest pass reserved successfully',
      token: guest.token,
      guest: this.toPassPayload(guest),
    };
  }

  private toPassPayload(guest: any) {
    return {
      name: guest.name || `Attendee #${guest.sequence}`,
      phone: guest.phone || '',
      role: guest.role || '',
      company: guest.company || '',
      sequence: guest.sequence,
      ticketType: guest.ticketType || 'Standard',
      registered: !!guest.registeredAt,
      used: guest.used,
      usedAt: guest.usedAt,
    };
  }

  /**
   * Read-only preview for attendees scanning their pass with a personal phone browser
   */
  async getPassDetails(token: string) {
    const guest = await this.guestModel.findOne({ token });

    if (!guest) {
      throw new NotFoundException('Invalid QR code access pass');
    }

    const registered = !!guest.registeredAt;

    return {
      success: true,
      valid: !guest.used,
      claimed: guest.used,
      registered,
      message: guest.used
        ? `Pass Already Claimed & Checked In on ${guest.usedAt ? new Date(guest.usedAt).toLocaleString() : 'earlier'}`
        : registered
          ? 'Pass Valid For Gate Check-In'
          : 'Tell us who you are to reserve this pass',
      name: guest.name || `Attendee #${guest.sequence}`,
      phone: guest.phone || '',
      role: guest.role || '',
      company: guest.company || '',
      sequence: guest.sequence,
      ticketType: guest.ticketType || 'Standard',
      used: guest.used,
      usedAt: guest.usedAt,
      guest: this.toPassPayload(guest),
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
      guest: this.toPassPayload(guest),
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
      const frontendPort = process.env.FRONTEND_PORT || '47312';
      const qrBuffer = await QRCode.toBuffer(
        `http://${targetHost}:${frontendPort}/guests/verify/${g.token}`,
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

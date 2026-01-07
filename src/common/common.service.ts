import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { randomBytes } from 'crypto';
import archiver from 'archiver';

import * as QRCode from 'qrcode';
import { Response } from 'express';

@Injectable()
export class CommonService {
  constructor(@InjectModel('Common') private commonModel: Model<any>) {}

  generateToken() {
    return randomBytes(10).toString('hex');
  }

  async createCommon(name: string) {
    const token = this.generateToken();
    return this.commonModel.create({ name, token });
  }

  async verifyToken(token: string) {
    const guest = await this.commonModel.findOne({ token });

    if (!guest) {
      throw new UnauthorizedException('Invalid QR code');
    }

    await guest.save();

    return {
      success: true,
      name: guest.name,
    };
  }

  async findAll() {
    return this.commonModel.find();
  }
  async bulkCreate(count: number) {
    const last = await this.commonModel.findOne().sort({ sequence: -1 }).lean();

    let start = last?.sequence || 0;

    const commons = Array.from({ length: count }).map((_, i) => ({
      sequence: start + i + 1,
      token: this.generateToken(),
    }));

    await this.commonModel.insertMany(commons);

    return { success: true, created: count };
  }

  async downloadZip(res: Response) {
    const commons = await this.commonModel.find().sort({ sequence: 1 }).lean();

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="wedding_qr_codes.zip"',
    );

    const archive = archiver('zip', { zlib: { level: 9 } });
    archive.pipe(res);

    for (let i = 0; i < commons.length; i++) {
      const g = commons[i];
      const number = String(g.sequence || i + 1).padStart(3, '0');

      const qrBuffer = await QRCode.toBuffer(
        `http://localhost:5173/verify/${g.token}`,
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
}

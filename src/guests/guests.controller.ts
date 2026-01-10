import { Controller, Post, Body, Get, Param, Res } from '@nestjs/common';
import { GuestsService } from './guests.service';
import express from 'express';

@Controller('guests')
export class GuestsController {
  constructor(private service: GuestsService) {}

  @Post()
  create(@Body('name') name: string) {
    return this.service.createGuest(name);
  }

  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.service.verifyToken(token);
  }

  @Get()
  all() {
    return this.service.findAll();
  }
  @Post('bulk')
  bulkCreate(@Body('count') count: number) {
    return this.service.bulkCreate(count);
  }
  @Get('used')
  getUsedGuests() {
    return this.service.findUsedGuests();
  }

  @Get('download/zip')
  async downloadZip(@Res() res: express.Response): Promise<void> {
    await this.service.downloadZip(res);
  }

  @Post('reset/:id')
  resetSingleGuest(@Param('id') id: string) {
    return this.service.resetGuestUsedStatus(id);
  }

  /**
   * Reset ALL guests → used: false
   * Example: POST /guests/reset-all
   */
  @Post('reset-all')
  resetAllGuests() {
    return this.service.resetAllGuestsUsedStatus();
  }
}

import { Controller, Post, Body, Get, Param, Res, UseGuards } from '@nestjs/common';
import { GuestsService } from './guests.service';
import { RegisterGuestDto } from './dto/register-guest.dto';
import { AdminGuard } from '../auth/admin.guard';
import express from 'express';

@Controller('guests')
export class GuestsController {
  constructor(private service: GuestsService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body('name') name: string, @Body('ticketType') ticketType: string) {
    return this.service.createGuest(name, ticketType);
  }

  /** Open: an attendee previewing the pass they just scanned */
  @Get('verify/:token')
  getPassDetails(@Param('token') token: string) {
    return this.service.getPassDetails(token);
  }

  /**
   * Open: the attendee filled in the info page on their phone after scanning
   * their printed pass. The token is the credential here.
   * Example: POST /guests/register/:token
   */
  @Post('register/:token')
  register(@Param('token') token: string, @Body() body: RegisterGuestDto) {
    return this.service.registerGuest(token, body);
  }

  /**
   * Staff only: registers a walk-up attendee who has no printed pass, which
   * creates a brand new pass, so it must never be open to the public.
   * Example: POST /guests/register
   */
  @Post('register')
  @UseGuards(AdminGuard)
  selfRegister(
    @Body() body: RegisterGuestDto,
    @Body('ticketType') ticketType: string,
  ) {
    return this.service.selfRegister(body, ticketType);
  }

  /** Open: the gate scanner app checks a pass in */
  @Post('checkin/:token')
  checkInPass(@Param('token') token: string) {
    return this.service.checkInPass(token);
  }

  /** Open: same check-in action, kept for older scanner builds */
  @Post('verify/:token')
  checkInPassPost(@Param('token') token: string) {
    return this.service.checkInPass(token);
  }

  @Get()
  @UseGuards(AdminGuard)
  all() {
    return this.service.findAll();
  }

  @Post('bulk')
  @UseGuards(AdminGuard)
  bulkCreate(@Body('count') count: number, @Body('ticketType') ticketType: string) {
    return this.service.bulkCreate(count, ticketType);
  }

  @Get('used')
  @UseGuards(AdminGuard)
  getUsedGuests() {
    return this.service.findUsedGuests();
  }

  @Get('download/zip')
  @UseGuards(AdminGuard)
  async downloadZip(@Res() res: express.Response): Promise<void> {
    await this.service.downloadZip(res);
  }

  @Post('reset/:id')
  @UseGuards(AdminGuard)
  resetSingleGuest(@Param('id') id: string) {
    return this.service.resetGuestUsedStatus(id);
  }

  /**
   * Reset ALL guests → used: false
   * Example: POST /guests/reset-all
   */
  @Post('reset-all')
  @UseGuards(AdminGuard)
  resetAllGuests() {
    return this.service.resetAllGuestsUsedStatus();
  }
}

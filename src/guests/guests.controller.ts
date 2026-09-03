import { Controller, Post, Body, Get, Param, Res } from '@nestjs/common';
import { GuestsService } from './guests.service';
import { RegisterGuestDto } from './dto/register-guest.dto';
import express from 'express';

@Controller('guests')
export class GuestsController {
  constructor(private service: GuestsService) {}

  @Post()
  create(@Body('name') name: string, @Body('ticketType') ticketType: string) {
    return this.service.createGuest(name, ticketType);
  }

  @Get('verify/:token')
  getPassDetails(@Param('token') token: string) {
    return this.service.getPassDetails(token);
  }

  /**
   * Attendee filled in the info page on their phone after scanning
   * their printed pass
   * Example: POST /guests/register/:token
   */
  @Post('register/:token')
  register(@Param('token') token: string, @Body() body: RegisterGuestDto) {
    return this.service.registerGuest(token, body);
  }

  /**
   * Walk-up attendee with no printed pass filled in the same info page
   * Example: POST /guests/register
   */
  @Post('register')
  selfRegister(
    @Body() body: RegisterGuestDto,
    @Body('ticketType') ticketType: string,
  ) {
    return this.service.selfRegister(body, ticketType);
  }

  @Post('checkin/:token')
  checkInPass(@Param('token') token: string) {
    return this.service.checkInPass(token);
  }

  @Post('verify/:token')
  checkInPassPost(@Param('token') token: string) {
    return this.service.checkInPass(token);
  }

  @Get()
  all() {
    return this.service.findAll();
  }
  @Post('bulk')
  bulkCreate(@Body('count') count: number, @Body('ticketType') ticketType: string) {
    return this.service.bulkCreate(count, ticketType);
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

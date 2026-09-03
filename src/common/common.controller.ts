import { Controller, Post, Body, Get, Param, Res, UseGuards } from '@nestjs/common';
import { CommonService } from './common.service';
import { AdminGuard } from '../auth/admin.guard';
import express from 'express';

@Controller('common')
export class CommonController {
  constructor(private service: CommonService) {}

  @Post()
  @UseGuards(AdminGuard)
  create(@Body('name') name: string) {
    return this.service.createCommon(name);
  }

  /** Open: an attendee checking a common pass */
  @Get('verify/:token')
  verify(@Param('token') token: string) {
    return this.service.verifyToken(token);
  }

  @Get()
  @UseGuards(AdminGuard)
  all() {
    return this.service.findAll();
  }

  @Post('bulk')
  @UseGuards(AdminGuard)
  bulkCreate(@Body('count') count: number) {
    return this.service.bulkCreate(count);
  }

  @Get('download/zip')
  @UseGuards(AdminGuard)
  async downloadZip(@Res() res: express.Response): Promise<void> {
    await this.service.downloadZip(res);
  }
}

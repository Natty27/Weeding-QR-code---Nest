import { Controller, Post, Body, Get, Param, Res } from '@nestjs/common';
import { CommonService } from './common.service';
import express from 'express';

@Controller('common')
export class CommonController {
  constructor(private service: CommonService) {}

  @Post()
  create(@Body('name') name: string) {
    return this.service.createCommon(name);
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

  @Get('download/zip')
  async downloadZip(@Res() res: express.Response): Promise<void> {
    await this.service.downloadZip(res);
  }
}

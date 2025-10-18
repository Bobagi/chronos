import { Controller, Get } from '@nestjs/common';
import { AppService, ApplicationHomeSummary } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getApplicationHome(): ApplicationHomeSummary {
    return this.appService.getApplicationHomeSummary();
  }
}

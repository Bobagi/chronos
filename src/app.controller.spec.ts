import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService, ApplicationHomeSummary } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should describe the API entry point', () => {
      const expectedSummary: ApplicationHomeSummary = {
        message: 'Chronos API is ready to accept requests.',
        documentationUrl: '/api',
        healthCheckUrl: '/game/test',
      };

      expect(appController.getApplicationHome()).toEqual(expectedSummary);
    });
  });
});

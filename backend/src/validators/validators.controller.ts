import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ValidatorsService } from './validators.service';

// Validator health dashboard (F8).
@UseGuards(JwtAuthGuard)
@Controller('validators')
export class ValidatorsController {
  constructor(private validators: ValidatorsService) {}

  @Get()
  list() {
    return this.validators.list();
  }
}

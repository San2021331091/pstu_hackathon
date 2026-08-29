import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { GroupsService } from './groups.service';
import { CreateGroupDto, CreateProposalDto, FundGroupDto, VoteDto } from './dto/group.dtos';

@Controller('groups')
@UseGuards(JwtAuthGuard)
export class GroupsController {
  constructor(private groups: GroupsService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateGroupDto) {
    return this.groups.create(user.userId, dto);
  }

  @Get()
  listMine(@CurrentUser() user: AuthUser) {
    return this.groups.listMine(user.userId);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.groups.get(user.userId, id);
  }

  @Post(':id/fund')
  fund(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: FundGroupDto) {
    return this.groups.fund(user.userId, id, dto.amount);
  }

  @Post(':id/proposals')
  propose(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateProposalDto) {
    return this.groups.propose(user.userId, id, dto);
  }

  @Post('proposals/:proposalId/vote')
  vote(
    @CurrentUser() user: AuthUser,
    @Param('proposalId') proposalId: string,
    @Body() dto: VoteDto,
  ) {
    return this.groups.vote(user.userId, proposalId, dto.approve);
  }
}

import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/send-message.dto';

@Controller()
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  @Post('messages')
  sendMessage(@Req() req: { user: { id: string } }, @Body() dto: SendMessageDto) {
    return this.messageService.sendMessage(req.user.id, dto.recipient_id, dto.content);
  }

  @Get('conversations')
  getConversations(@Req() req: { user: { id: string } }) {
    return this.messageService.getConversations(req.user.id);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @Req() req: { user: { id: string } },
    @Param('conversationId') conversationId: string,
    @Query('page') page?: string,
  ) {
    return this.messageService.getMessages(req.user.id, conversationId, page ? +page : 1);
  }

  @Patch('conversations/:conversationId/read')
  markRead(
    @Req() req: { user: { id: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messageService.markRead(req.user.id, conversationId);
  }

  @Delete('conversations/:conversationId')
  @HttpCode(204)
  deleteConversation(
    @Req() req: { user: { id: string } },
    @Param('conversationId') conversationId: string,
  ) {
    return this.messageService.deleteConversation(req.user.id, conversationId);
  }
}

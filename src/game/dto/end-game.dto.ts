import { IsUUID } from 'class-validator';

export class EndGameDto {
  @IsUUID()
  gameId: string;
}

import { IsString } from 'class-validator';

export class PlayCardDto {
  @IsString()
  gameId: string;

  @IsString()
  player: string;

  @IsString()
  card: string;
}

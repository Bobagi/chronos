import { IsString } from 'class-validator';

export class PlayCardDto {
  @IsString()
  player: string;

  @IsString()
  card: string;
}

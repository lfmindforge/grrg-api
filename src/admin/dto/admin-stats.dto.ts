import { ApiProperty } from '@nestjs/swagger';

export class AdminKpisDto {
  @ApiProperty() total_users!: number;
  @ApiProperty() total_wishes!: number;
  @ApiProperty() total_donations!: number;
  @ApiProperty() total_donations_completed!: number;
}

export class CountByKeyDto {
  @ApiProperty() key!: string;
  @ApiProperty() count!: number;
}

export class ActivityDayDto {
  @ApiProperty() date!: string;
  @ApiProperty() users!: number;
  @ApiProperty() wishes!: number;
  @ApiProperty() donations!: number;
}

export class AdminStatsDto {
  @ApiProperty({ type: AdminKpisDto })
  kpis!: AdminKpisDto;

  @ApiProperty({ type: [CountByKeyDto] })
  donations_by_type!: CountByKeyDto[];

  @ApiProperty({ type: [CountByKeyDto] })
  wishes_by_status!: CountByKeyDto[];

  @ApiProperty({ type: [CountByKeyDto] })
  top_categories!: CountByKeyDto[];

  @ApiProperty({ type: [ActivityDayDto] })
  activity!: ActivityDayDto[];
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChartDataRequestDto, ChartType, TimeRange, MetricType } from './dto/chart-data.dto';
import { TimeComparisonDto, ComparisonPeriod } from './dto/time-comparison.dto';
import { PredictionDto } from './dto/prediction.dto';

export interface ComparisonDataItem {
  period: string;
  periodStart: Date;
  periodEnd: Date;
  value: number;
  change: number | null;
  data: number[];
}

@Injectable()
export class AdvancedDashboardService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get interactive chart data
   */
  async getChartData(request: ChartDataRequestDto) {
    const { chartType, metricType, timeRange, startDate, endDate, groupBy = 'day' } = request;

    const dateRange = this.calculateDateRange(timeRange, startDate, endDate);
    const data = await this.getMetricData(metricType, dateRange, groupBy);

    return {
      success: true,
      data: {
        chartType,
        metricType,
        labels: data.labels,
        datasets: data.datasets,
        summary: data.summary,
      },
    };
  }

  /**
   * Get time comparison data
   */
  async getTimeComparison(comparison: TimeComparisonDto) {
    const { metricType, period, periods = 3, startDate, endDate } = comparison;

    const comparisonData: ComparisonDataItem[] = [];
    const now = new Date();

    for (let i = periods - 1; i >= 0; i--) {
      const periodStart = this.getPeriodStart(period, now, i);
      const periodEnd = this.getPeriodEnd(period, periodStart);

      const dateRange = {
        startDate: startDate ? new Date(startDate) : periodStart,
        endDate: endDate ? new Date(endDate) : periodEnd,
      };

      const data = await this.getMetricData(metricType, dateRange, 'day');
      const total = this.calculateTotal(data.datasets[0]?.data || []);

      comparisonData.push({
        period: this.formatPeriod(period, periodStart),
        periodStart,
        periodEnd,
        value: total,
        change: i < periods - 1 ? this.calculateChange(total, comparisonData[periods - 2 - i].value) : null,
        data: data.datasets[0]?.data || [],
      });
    }

    return {
      success: true,
      data: {
        metricType,
        period,
        comparisons: comparisonData,
        average: this.calculateAverage(comparisonData.map((c) => c.value)),
        trend: this.calculateTrend(comparisonData.map((c) => c.value)),
      },
    };
  }

  /**
   * Get predictions and analytics
   */
  async getPredictions(prediction: PredictionDto) {
    const { metricType, periods = 3, periodType = 'month', startDate, endDate } = prediction;

    // Get historical data
    const historicalStart = startDate
      ? new Date(startDate)
      : new Date(new Date().setMonth(new Date().getMonth() - 6));
    const historicalEnd = endDate ? new Date(endDate) : new Date();

    const historicalData = await this.getMetricData(
      metricType,
      { startDate: historicalStart, endDate: historicalEnd },
      periodType,
    );

    // Calculate predictions using simple linear regression
    const predictions = this.calculateLinearRegression(
      historicalData.datasets[0]?.data || [],
      periods,
    );

    // Calculate growth rate
    const growthRate = this.calculateGrowthRate(historicalData.datasets[0]?.data || []);

    // Calculate confidence interval
    const confidence = this.calculateConfidence(historicalData.datasets[0]?.data || []);

    return {
      success: true,
      data: {
        metricType,
        historical: {
          labels: historicalData.labels,
          data: historicalData.datasets[0]?.data || [],
        },
        predictions: {
          labels: this.generateFutureLabels(periods, periodType),
          data: predictions,
          confidence: {
            upper: predictions.map((p, i) => p + confidence),
            lower: predictions.map((p, i) => p - confidence),
          },
          growthRate,
        },
        analytics: {
          average: this.calculateAverage(historicalData.datasets[0]?.data || []),
          trend: this.calculateTrend(historicalData.datasets[0]?.data || []),
          volatility: this.calculateVolatility(historicalData.datasets[0]?.data || []),
        },
      },
    };
  }

  // Private helper methods

  private calculateDateRange(
    timeRange: TimeRange,
    startDate?: string,
    endDate?: string,
  ): { startDate: Date; endDate: Date } {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now);

    if (timeRange === TimeRange.CUSTOM && startDate && endDate) {
      return {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    }

    switch (timeRange) {
      case TimeRange.LAST_7_DAYS:
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        break;
      case TimeRange.LAST_30_DAYS:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        break;
      case TimeRange.LAST_3_MONTHS:
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      case TimeRange.LAST_6_MONTHS:
        start = new Date(now);
        start.setMonth(now.getMonth() - 6);
        break;
      case TimeRange.LAST_YEAR:
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      default:
        start = new Date(now);
        start.setDate(now.getDate() - 30);
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { startDate: start, endDate: end };
  }

  private async getMetricData(
    metricType: MetricType,
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    switch (metricType) {
      case MetricType.REVENUE:
        return await this.getRevenueData(dateRange, groupBy);
      case MetricType.USERS:
        return await this.getUsersData(dateRange, groupBy);
      case MetricType.SALONS:
        return await this.getSalonsData(dateRange, groupBy);
      case MetricType.SUBSCRIPTIONS:
        return await this.getSubscriptionsData(dateRange, groupBy);
      case MetricType.PAYMENTS:
        return await this.getPaymentsData(dateRange, groupBy);
      case MetricType.REVIEWS:
        return await this.getReviewsData(dateRange, groupBy);
      case MetricType.VISITS:
        return await this.getVisitsData(dateRange, groupBy);
      default:
        throw new Error(`Unsupported metric type: ${metricType}`);
    }
  }

  private async getRevenueData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'COMPLETED',
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        amount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(payments, groupBy, (p) => Number(p.amount));
  }

  private async getUsersData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
        role: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(users, groupBy, () => 1);
  }

  private async getSalonsData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const salons = await this.prisma.salon.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(salons, groupBy, () => 1);
  }

  private async getSubscriptionsData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
        status: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(subscriptions, groupBy, () => 1);
  }

  private async getPaymentsData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const payments = await this.prisma.payment.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        amount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(payments, groupBy, (p) => Number(p.amount));
  }

  private async getReviewsData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const reviews = await this.prisma.review.findMany({
      where: {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        createdAt: true,
        rating: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return this.groupDataByPeriod(reviews, groupBy, () => 1);
  }

  private async getVisitsData(
    dateRange: { startDate: Date; endDate: Date },
    groupBy: string,
  ) {
    const visits = await this.prisma.visit.findMany({
      where: {
        visitDate: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      },
      select: {
        visitDate: true,
        status: true,
      },
      orderBy: { visitDate: 'asc' },
    });

    return this.groupDataByPeriod(visits, groupBy, () => 1, 'visitDate');
  }

  private groupDataByPeriod(
    data: any[],
    groupBy: string,
    valueExtractor: (item: any) => number,
    dateField: string = 'createdAt',
  ) {
    const grouped = new Map<string, number>();

    data.forEach((item) => {
      const date = new Date(item[dateField]);
      const key = this.getPeriodKey(date, groupBy);
      const current = grouped.get(key) || 0;
      grouped.set(key, current + valueExtractor(item));
    });

    const labels: string[] = [];
    const values: number[] = [];

    // Fill in missing periods
    const sortedKeys = Array.from(grouped.keys()).sort();
    if (sortedKeys.length > 0) {
      const startDate = this.parsePeriodKey(sortedKeys[0], groupBy);
      const endDate = this.parsePeriodKey(sortedKeys[sortedKeys.length - 1], groupBy);
      const periods = this.generatePeriods(startDate, endDate, groupBy);

      periods.forEach((period) => {
        const key = this.getPeriodKey(period, groupBy);
        labels.push(this.formatPeriodKey(key, groupBy));
        values.push(grouped.get(key) || 0);
      });
    }

    const total = values.reduce((sum, val) => sum + val, 0);
    const average = values.length > 0 ? total / values.length : 0;

    return {
      labels,
      datasets: [
        {
          label: 'Value',
          data: values,
        },
      ],
      summary: {
        total,
        average,
        min: Math.min(...values),
        max: Math.max(...values),
      },
    };
  }

  private getPeriodKey(date: Date, groupBy: string): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const week = this.getWeekNumber(date);

    switch (groupBy) {
      case 'day':
        return `${year}-${month}-${day}`;
      case 'week':
        return `${year}-W${week}`;
      case 'month':
        return `${year}-${month}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private parsePeriodKey(key: string, groupBy: string): Date {
    const parts = key.split('-');
    if (groupBy === 'week') {
      const year = parseInt(parts[0]);
      const week = parseInt(parts[1].replace('W', ''));
      return this.getDateFromWeek(year, week);
    }
    return new Date(key);
  }

  private formatPeriodKey(key: string, groupBy: string): string {
    if (groupBy === 'week') {
      return key;
    }
    const date = new Date(key);
    return date.toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: groupBy === 'day' ? 'numeric' : undefined,
    });
  }

  private generatePeriods(startDate: Date, endDate: Date, groupBy: string): Date[] {
    const periods: Date[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      periods.push(new Date(current));

      switch (groupBy) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
      }
    }

    return periods;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }

  private getDateFromWeek(year: number, week: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  }

  private getPeriodStart(period: ComparisonPeriod, now: Date, offset: number): Date {
    const start = new Date(now);

    switch (period) {
      case ComparisonPeriod.DAY:
        start.setDate(now.getDate() - offset);
        start.setHours(0, 0, 0, 0);
        break;
      case ComparisonPeriod.WEEK:
        start.setDate(now.getDate() - offset * 7);
        start.setDate(start.getDate() - start.getDay() + 1);
        start.setHours(0, 0, 0, 0);
        break;
      case ComparisonPeriod.MONTH:
        start.setMonth(now.getMonth() - offset);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case ComparisonPeriod.QUARTER:
        start.setMonth(now.getMonth() - offset * 3);
        start.setMonth(Math.floor(start.getMonth() / 3) * 3);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
      case ComparisonPeriod.YEAR:
        start.setFullYear(now.getFullYear() - offset);
        start.setMonth(0);
        start.setDate(1);
        start.setHours(0, 0, 0, 0);
        break;
    }

    return start;
  }

  private getPeriodEnd(period: ComparisonPeriod, start: Date): Date {
    const end = new Date(start);

    switch (period) {
      case ComparisonPeriod.DAY:
        end.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.WEEK:
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.MONTH:
        end.setMonth(start.getMonth() + 1);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.QUARTER:
        end.setMonth(start.getMonth() + 3);
        end.setDate(0);
        end.setHours(23, 59, 59, 999);
        break;
      case ComparisonPeriod.YEAR:
        end.setMonth(11);
        end.setDate(31);
        end.setHours(23, 59, 59, 999);
        break;
    }

    return end;
  }

  private formatPeriod(period: ComparisonPeriod, date: Date): string {
    switch (period) {
      case ComparisonPeriod.DAY:
        return date.toLocaleDateString('ar-SA');
      case ComparisonPeriod.WEEK:
        return `Week ${this.getWeekNumber(date)}`;
      case ComparisonPeriod.MONTH:
        return date.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' });
      case ComparisonPeriod.QUARTER:
        const quarter = Math.floor(date.getMonth() / 3) + 1;
        return `Q${quarter} ${date.getFullYear()}`;
      case ComparisonPeriod.YEAR:
        return date.getFullYear().toString();
      default:
        return date.toLocaleDateString('ar-SA');
    }
  }

  private calculateTotal(data: number[]): number {
    return data.reduce((sum, val) => sum + val, 0);
  }

  private calculateAverage(data: number[]): number {
    if (data.length === 0) return 0;
    return this.calculateTotal(data) / data.length;
  }

  private calculateChange(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  }

  private calculateTrend(data: number[]): 'up' | 'down' | 'stable' {
    if (data.length < 2) return 'stable';
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const firstAvg = this.calculateAverage(firstHalf);
    const secondAvg = this.calculateAverage(secondHalf);
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    if (change > 5) return 'up';
    if (change < -5) return 'down';
    return 'stable';
  }

  private calculateLinearRegression(data: number[], periods: number): number[] {
    if (data.length < 2) {
      const lastValue = data[data.length - 1] || 0;
      return Array(periods).fill(lastValue);
    }

    const n = data.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = data;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const predictions: number[] = [];
    for (let i = 0; i < periods; i++) {
      predictions.push(slope * (n + i) + intercept);
    }

    return predictions.map((p) => Math.max(0, p)); // Ensure non-negative
  }

  private calculateGrowthRate(data: number[]): number {
    if (data.length < 2) return 0;
    const first = data[0];
    const last = data[data.length - 1];
    if (first === 0) return last > 0 ? 100 : 0;
    return ((last - first) / first) * 100;
  }

  private calculateConfidence(data: number[]): number {
    if (data.length < 2) return 0;
    const avg = this.calculateAverage(data);
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / data.length;
    return Math.sqrt(variance) * 1.96; // 95% confidence interval
  }

  private calculateVolatility(data: number[]): number {
    if (data.length < 2) return 0;
    const avg = this.calculateAverage(data);
    const variance =
      data.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / data.length;
    return Math.sqrt(variance) / avg; // Coefficient of variation
  }

  private generateFutureLabels(periods: number, periodType: string): string[] {
    const labels: string[] = [];
    const now = new Date();

    for (let i = 1; i <= periods; i++) {
      const futureDate = new Date(now);
      switch (periodType) {
        case 'day':
          futureDate.setDate(now.getDate() + i);
          labels.push(futureDate.toLocaleDateString('ar-SA'));
          break;
        case 'week':
          futureDate.setDate(now.getDate() + i * 7);
          labels.push(`Week ${this.getWeekNumber(futureDate)}`);
          break;
        case 'month':
          futureDate.setMonth(now.getMonth() + i);
          labels.push(futureDate.toLocaleDateString('ar-SA', { month: 'long', year: 'numeric' }));
          break;
      }
    }

    return labels;
  }
}


export interface ChartConfig {
  title?: string;
  type: 'bar' | 'line' | 'scatter' | 'pie' | 'box' | 'area';
  width: number;
  height: number;
  padding: { top: number; right: number; bottom: number; left: number };
  xLabel?: string;
  yLabel?: string;
  labels?: string[];
}

export interface DataSeries {
  name: string;
  x?: number[];
  y: number[];
  labels?: string[];
}

export const palette = ['#2563eb', '#dc2626', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

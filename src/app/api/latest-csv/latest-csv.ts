import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const csvDir = path.join(process.cwd(), 'public', 'csv');
  try {
    const files = fs.readdirSync(csvDir, { withFileTypes: true })
      .filter(file => !file.name.startsWith('_gsdata_') && file.isFile())
      .map(file => file.name);

    // Filter for CSV files
    const csvFiles = files.filter(file => file.endsWith('.csv'));

    // Sort files by creation time, descending
    const latestFile = csvFiles.sort((a, b) => {
      const aStat = fs.statSync(path.join(csvDir, a));
      const bStat = fs.statSync(path.join(csvDir, b));
      return bStat.mtimeMs - aStat.mtimeMs;
    })[0];
    
    if (latestFile) {
      return NextResponse.json({ latestFile });
    } else {
      return NextResponse.json({ latestFile: null }, { status: 404 });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Error reading files' }, { status: 500 });
  }
}

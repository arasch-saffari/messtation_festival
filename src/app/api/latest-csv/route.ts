import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Pfad zum public-Verzeichnis
    const csvDir = path.join(process.cwd(), 'public', 'csv');
    
    // Liest alle Dateien im Verzeichnis
    const files = fs.readdirSync(csvDir);
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }
    
    // Sortiere die Dateien nach dem Änderungsdatum (neueste zuerst)
    const latestFile = files
      .map(file => ({
        file,
        time: fs.statSync(path.join(csvDir, file)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time)[0]?.file;
    
    if (!latestFile) {
      return NextResponse.json({ error: 'No files found' }, { status: 404 });
    }
    
    // Gibt die neueste Datei als JSON zurück
    return NextResponse.json({ latestFile });
  } catch (error) {
    console.error('Error retrieving latest CSV file:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

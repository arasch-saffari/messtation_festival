"use client";

import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface DataRow {
  Datum: string;
  "Systemzeit ": string;
  LAS: string;
}

interface ProcessedRow {
  Datum: string;
  Systemzeit: string;
  "LAS Mittelwert": string;
}

export default function Home() {
  const [data, setData] = useState<ProcessedRow[]>([]);
  const [headers, setHeaders] = useState<(keyof ProcessedRow)[]>([
    "Datum",
    "Systemzeit",
    "LAS Mittelwert",
  ]);
  const [latestEntry, setLatestEntry] = useState<ProcessedRow | null>(null);

  useEffect(() => {
    fetch("/api/latest-csv")
      .then((response) => response.json())
      .then((data) => {
        if (data.latestFile) {
          return fetch(`/csv/${data.latestFile}`);
        } else {
          throw new Error("No CSV files found");
        }
      })
      .then((response) => response.text())
      .then((text) => {
        const result = Papa.parse<DataRow>(text, {
          header: true,
          delimiter: ";",
        });
        const filteredData = calculateAverages(result.data);
        const reversedData = filteredData.reverse();
        setData(reversedData);
        setLatestEntry(reversedData[0]);
      })
      .catch((error) => {
        console.error("Fehler beim Laden der CSV-Datei:", error);
      });
  }, []);

  const calculateAverages = (data: DataRow[]) => {
    let result: ProcessedRow[] = [];
    let tempData: number[] = [];
    let currentQuarterHour: number | null = null;
    let currentStartTime: string | null = null;

    data.forEach((row: DataRow) => {
      const timeParts = row["Systemzeit "].split(":");
      const minutes = parseInt(timeParts[1], 10);
      const quarterHour = Math.floor(minutes / 15);

      if (currentQuarterHour === null) {
        currentQuarterHour = quarterHour;
        currentStartTime = row["Systemzeit "];
      }

      if (quarterHour === currentQuarterHour) {
        tempData.push(parseFloat(row.LAS.replace(",", ".")));
      } else {
        const avgLAS = (
          tempData.reduce((acc, val) => acc + val, 0) / tempData.length
        ).toFixed(2);
        result.push({
          Datum: tempData.length > 0 ? row.Datum : "",
          Systemzeit: truncateTime(currentStartTime!),
          "LAS Mittelwert": avgLAS,
        });
        tempData = [parseFloat(row.LAS.replace(",", "."))];
        currentQuarterHour = quarterHour;
        currentStartTime = row["Systemzeit "];
      }
    });

    if (tempData.length > 0) {
      const avgLAS = (
        tempData.reduce((acc, val) => acc + val, 0) / tempData.length
      ).toFixed(2);
      result.push({
        Datum: data[data.length - 1].Datum,
        Systemzeit: truncateTime(currentStartTime!),
        "LAS Mittelwert": avgLAS,
      });
    }

    return result;
  };

  const truncateTime = (time: string) => {
    const timeParts = time.split(":");
    return `${timeParts[0]}:${timeParts[1]}`;
  };

  const getLASClass = (las: number) => {
    if (las <= 50) return "bg-green-200 text-green-800";
    if (las <= 55) return "bg-yellow-200 text-yellow-800";
    return "bg-red-200 text-red-800";
  };

  const getLASEmoji = (las: number) => {
    if (las <= 50) return "😊";
    if (las <= 55) return "😐";
    return "😡";
  };

  const chartData = {
    labels: [...data].reverse().map((row) => row.Systemzeit),
    datasets: [
      {
        label: "LAS Mittelwert",
        data: [...data]
          .reverse()
          .map((row) => parseFloat(row["LAS Mittelwert"])),
        borderColor: "rgba(75, 192, 192, 1)",
        backgroundColor: "rgba(75, 192, 192, 0.2)",
        borderWidth: 1,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        callbacks: {
          label: (tooltipItem: any) => `LAS Mittelwert: ${tooltipItem.raw} dB`,
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Systemzeit",
        },
      },
      y: {
        title: {
          display: true,
          text: "LAS Mittelwert (dB)",
        },
        beginAtZero: true,
      },
    },
  };

  return (
    <div className="container mx-auto p-4 ">
      <h1 className="text-2xl font-bold mb-4 text-white-900 mx-auto text-center">
        Mess-Station - Zug Vögel Festival
      </h1>
      {latestEntry && (
        <div
          className={`p-4 mb-8 text-xl font-bold rounded-md text-black shadow-xl shadow-gray-600 ${getLASClass(
            parseFloat(latestEntry["LAS Mittelwert"])
          )}`}
        >
          <p>Datum: {latestEntry.Datum}</p>
          <p>Systemzeit: {latestEntry.Systemzeit}</p>
          <p>
            LAS Mittelwert: {latestEntry["LAS Mittelwert"]} dB{" "}
            {getLASEmoji(parseFloat(latestEntry["LAS Mittelwert"]))}
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-300 p-4 mb-8 rounded-md shadow-xl shadow-gray-600">
        <h2 className="text-xl font-bold mb-2">LAS Mittelwert Graph</h2>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="overflow-x-auto rounded-md mb-4 shadow-xl shadow-gray-600">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              {headers.map((header) => (
                <th
                  key={header}
                  className="py-2 px-4 border-b border-gray-300 text-left text-sm font-semibold text-gray-700"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={index}
                className={`bg-white ${index % 2 === 0 ? "bg-gray-50" : ""}`}
              >
                {headers.map((header) => (
                  <td
                    key={header}
                    className={`py-2 px-4 border-b border-gray-300 text-sm text-gray-900 ${
                      header === "LAS Mittelwert"
                        ? getLASClass(parseFloat(row[header]))
                        : ""
                    }`}
                  >
                    {row[header]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

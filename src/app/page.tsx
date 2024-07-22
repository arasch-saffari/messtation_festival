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
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
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
  const [sortConfig, setSortConfig] = useState<{
    key: keyof ProcessedRow;
    direction: "asc" | "desc";
  }>({ key: "Datum", direction: "asc" });

  useEffect(() => {
    const fetchData = () => {
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
          // Entferne den ersten Eintrag aus den Daten
          result.data.shift();
          const filteredData = calculateAverages(result.data);
          const reversedData = filteredData.reverse();
          setData(reversedData);
          setLatestEntry(reversedData[0]);
        })
        .catch((error) => {
          console.error("Fehler beim Laden der CSV-Datei:", error);
        });
    };

    fetchData();
    const intervalId = setInterval(fetchData, 5 * 60 * 1000); // Alle 5 Minuten aktualisieren

    return () => clearInterval(intervalId); // Cleanup bei Komponentendemontage
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

      const lasValue = row.LAS ? row.LAS.replace(",", ".") : null;
      if (lasValue && !isNaN(parseFloat(lasValue))) {
        if (quarterHour === currentQuarterHour) {
          tempData.push(parseFloat(lasValue));
        } else {
          const avgLAS = (
            tempData.reduce((acc, val) => acc + val, 0) / tempData.length
          ).toFixed(2);
          result.push({
            Datum: tempData.length > 0 ? row.Datum : "",
            Systemzeit: truncateTime(currentStartTime!),
            "LAS Mittelwert": avgLAS,
          });
          tempData = [parseFloat(lasValue)];
          currentQuarterHour = quarterHour;
          currentStartTime = row["Systemzeit "];
        }
      } else {
        console.warn("Ungültiger LAS-Wert in Zeile:", row);
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

  const getLASClass = (systemTime: string, las: number) => {
    const timeParts = systemTime.split(":");
    const hour = parseInt(timeParts[0], 10);
    if (hour >= 6 && hour < 22) {
      if (las >= 60) return "bg-red-600 text-white";
      if (las >= 55) return "bg-yellow-600 text-white";
      return "bg-green-600 text-white";
    } else {
      if (las >= 45) return "bg-red-600 text-white";
      if (las >= 43) return "bg-yellow-600 text-white";
      return "bg-green-600 text-white";
    }
  };

  const getLASEmoji = (systemTime: string, las: number) => {
    const timeParts = systemTime.split(":");
    const hour = parseInt(timeParts[0], 10);
    if (hour >= 6 && hour < 22) {
      if (las >= 60) return "😡";
      if (las >= 55) return "😐";
      return "😊";
    } else {
      if (las >= 45) return "😡";
      if (las >= 43) return "😐";
      return "😊";
    }
  };

  const chartData = {
    labels: [...data].reverse().map((row) => row.Systemzeit),
    datasets: [
      {
        label: "LAS Mittelwert",
        data: [...data]
          .reverse()
          .map((row) => parseFloat(row["LAS Mittelwert"])),
        borderColor: "rgba(151, 0, 255, 1)",
        backgroundColor: "rgba(151, 0, 192, 0.2)",
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
        min: 25, // Set the minimum value of the y-axis to 25
      },
    },
  };

  const sortData = (key: keyof ProcessedRow) => {
    const direction =
      sortConfig.key === key && sortConfig.direction === "asc" ? "desc" : "asc";
    const sortedData = [...data].sort((a, b) => {
      if (key === "LAS Mittelwert") {
        const aValue = parseFloat(a[key]);
        const bValue = parseFloat(b[key]);
        return direction === "asc" ? aValue - bValue : bValue - aValue;
      } else {
        return direction === "asc"
          ? a[key].localeCompare(b[key])
          : b[key].localeCompare(a[key]);
      }
    });
    setData(sortedData);
    setSortConfig({ key, direction });
  };

  const getSortIcon = (key: keyof ProcessedRow) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === "asc" ? " ▲" : " ▼";
    }
    return " ◇";
  };

  return (
    <div className="container mx-auto p-4 ">
      <img
        src="/logo_woodone.png"
        alt="Logo"
        className="h-16 mx-auto text-center"
      />

      <h1 className="text-2xl font-bold mb-4 text-white-900 mx-auto text-center">
        Messwerte - Festival
      </h1>
      {latestEntry && (
        <div
          className={`p-4 mb-8 text-xl font-bold rounded-md text-black shadow-md shadow-gray-500 ${getLASClass(
            latestEntry.Systemzeit,
            parseFloat(latestEntry["LAS Mittelwert"])
          )}`}
        >
          <p>Datum: {latestEntry.Datum}</p>
          <p>Systemzeit: {latestEntry.Systemzeit}</p>
          <p>
            LAS Mittelwert: {latestEntry["LAS Mittelwert"]} dB (A){" "}
            {getLASEmoji(
              latestEntry.Systemzeit,
              parseFloat(latestEntry["LAS Mittelwert"])
            )}
          </p>
        </div>
      )}

      <div className="bg-white border border-gray-300 p-4 mb-8 rounded-md shadow-md shadow-gray-500">
        <h2 className="text-xl font-bold mb-2">LAS Mittelwert Graph</h2>
        <Line data={chartData} options={chartOptions} />
      </div>

      <div className="overflow-x-auto rounded-md mb-4 shadow-md shadow-gray-800">
        <table className="min-w-full bg-white border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              {headers.map((header) => (
                <th
                  key={header}
                  className="py-2 px-4 border-b border-gray-300 text-left text-sm font-semibold text-gray-800 cursor-pointer"
                  onClick={() => sortData(header)}
                >
                  {header}
                  <span>{getSortIcon(header)}</span>
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
                        ? getLASClass(row.Systemzeit, parseFloat(row[header]))
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

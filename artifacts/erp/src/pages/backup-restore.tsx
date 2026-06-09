import React, { useState } from "react";
import {
  useGetBackupSettings,
  useUpdateBackupSettings,
  useListBackups,
  getListBackupsQueryKey,
  getGetBackupSettingsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  DatabaseBackup,
  Download,
  FileJson,
  FileArchive,
  CalendarClock,
  HardDriveDownload,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupRestore() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const settingsQuery = useGetBackupSettings();
  const historyQuery = useListBackups();
  const updateSettings = useUpdateBackupSettings();
  const [downloading, setDownloading] = useState<"zip" | "json" | null>(null);

  const settings = settingsQuery.data;

  const toggle = (key: "dailyEnabled" | "weeklyEnabled" | "monthlyEnabled", value: boolean) => {
    if (!settings) return;
    updateSettings.mutate(
      { data: { [key]: value } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetBackupSettingsQueryKey() });
          settingsQuery.refetch();
          toast({ title: "Backup preferences saved" });
        },
        onError: () => {
          toast({ title: "Failed to save preferences", variant: "destructive" });
        },
      },
    );
  };

  const download = async (format: "zip" | "json") => {
    setDownloading(format);
    try {
      const res = await fetch(`/api/system/backup/download?format=${format}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Download failed (${res.status})`);
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^"]+)"?/);
      const fileName = match?.[1] ?? `shradha-backup.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Backup downloaded", description: fileName });
      queryClient.invalidateQueries({ queryKey: getListBackupsQueryKey() });
      historyQuery.refetch();
    } catch (err) {
      toast({
        title: "Backup failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDownloading(null);
    }
  };

  const history = historyQuery.data ?? [];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <DatabaseBackup className="h-7 w-7 text-primary" /> Backup &amp; Restore
        </h1>
        <p className="text-muted-foreground mt-2">
          Export your complete company data, and configure automatic backups.
        </p>
      </div>

      <Tabs defaultValue="backup">
        <TabsList>
          <TabsTrigger value="backup" data-testid="tab-backup">
            <HardDriveDownload className="mr-2 h-4 w-4" /> Backup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="backup" className="space-y-6">
          {/* Manual backup */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <CardTitle>Manual Backup</CardTitle>
              </div>
              <CardDescription>
                Download a complete backup of all company data — masters, transactions,
                invoices, orders, manufacturing, accounting and settings — to your computer.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button
                onClick={() => download("zip")}
                disabled={downloading !== null}
                data-testid="button-backup-zip"
              >
                <FileArchive className="mr-2 h-4 w-4" />
                {downloading === "zip" ? "Preparing…" : "Download .zip"}
              </Button>
              <Button
                variant="outline"
                onClick={() => download("json")}
                disabled={downloading !== null}
                data-testid="button-backup-json"
              >
                <FileJson className="mr-2 h-4 w-4" />
                {downloading === "json" ? "Preparing…" : "Download .json"}
              </Button>
            </CardContent>
          </Card>

          {/* Automatic backup preferences */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-primary" />
                <CardTitle>Automatic Backup</CardTitle>
              </div>
              <CardDescription>
                Choose how often the system should automatically back up your data. These
                preferences are saved now; scheduled backups run in a later update.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { key: "dailyEnabled", label: "Daily Backup", desc: "Back up every day" },
                { key: "weeklyEnabled", label: "Weekly Backup", desc: "Back up once a week" },
                { key: "monthlyEnabled", label: "Monthly Backup", desc: "Back up once a month" },
              ].map((row) => (
                <div
                  key={row.key}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div>
                    <div className="font-medium">{row.label}</div>
                    <div className="text-sm text-muted-foreground">{row.desc}</div>
                  </div>
                  <Switch
                    checked={Boolean(settings?.[row.key as keyof typeof settings])}
                    disabled={!settings || updateSettings.isPending}
                    onCheckedChange={(v) =>
                      toggle(row.key as "dailyEnabled" | "weeklyEnabled" | "monthlyEnabled", v)
                    }
                    data-testid={`switch-${row.key}`}
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Backup history */}
          <Card>
            <CardHeader>
              <CardTitle>Backup History</CardTitle>
              <CardDescription>Recent backups, with date, size and who created them.</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No backups yet. Use Manual Backup above to create one.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead>Created By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((b) => (
                      <TableRow key={b.id} data-testid={`row-backup-${b.id}`}>
                        <TableCell className="whitespace-nowrap">{formatDate(b.createdAt)}</TableCell>
                        <TableCell className="font-mono text-xs">{b.fileName}</TableCell>
                        <TableCell className="capitalize">{b.type}</TableCell>
                        <TableCell className="text-right">{formatBytes(b.sizeBytes)}</TableCell>
                        <TableCell>{b.createdByName ?? "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

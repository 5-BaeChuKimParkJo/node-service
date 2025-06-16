type CustomLog = {
  type: 'CustomLog';
  message: string;
  time: string;
  logType: 'failed' | 'success';
  args?: Record<string, string | number | boolean> | undefined;
};

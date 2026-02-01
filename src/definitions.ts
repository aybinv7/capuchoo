export interface capuchoappsmanagerPlugin {
  echo(options: { value: string }): Promise<{ value: string }>;
}

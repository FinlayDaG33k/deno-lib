import { Buffer } from "https://deno.land/std@0.87.0/node/buffer.ts";

export enum PacketType {
  COMMAND = 0x02,
  AUTH = 0x03,
}

export class RCON {
  private conn!: Deno.Conn;

  /**
   * Connect to an RCON server.
   *
   * @param ip
   * @param port
   * @param password Optional password for authentication
   */
  public async connect(ip: string, port: number, password: string|null = null) {
    this.conn = await Deno.connect({
      hostname: ip,
      port: port,
    });

    if(password) await this.send(password, "AUTH");
  }

  /**
   * Send data to the server
   *
   * @param data
   * @param cmd
   * @returns Promise<string>
   */
  public async send(data: string, cmd?: keyof typeof PacketType): Promise<string> {
    cmd = cmd || "COMMAND";
    const length: number = Buffer.byteLength(data);
    const buf: Buffer = Buffer.alloc(length + 14);
    buf.writeInt32LE(length + 10, 0);
    buf.write(data, 12);
    buf.writeInt32LE(0x69420, 4);
    buf.writeInt32LE(PacketType[cmd], 8);

    buf.writeInt16LE(0, length + 12);

    await this.conn.write(buf);
    return await this.recv();
  }

  /**
   * Send data to the server.
   * It is preferred to use RCON#send instead.
   * TODO: Return data received from server
   *
   * @param data
   * @param cmd
   * @returns void
   */
  public sendSync(data: string, cmd?: keyof typeof PacketType): void {
    cmd = cmd || "COMMAND";
    const length: number = Buffer.byteLength(data);
    const buf: Buffer = Buffer.alloc(length + 14);
    buf.writeInt32LE(length + 10, 0);
    buf.write(data, 12);
    buf.writeInt32LE(0x69420, 4);
    buf.writeInt32LE(PacketType[cmd], 8);

    buf.writeInt16LE(0, length + 12);

    this.conn.write(buf);
  }

  /**
   * Close connection to the server
   *
   * @returns Promise<void>
   */
  public async close(): Promise<void> {
    await this.conn.close();
  }

  /**
   * Create a buffer to receive data from the server
   *
   * @returns Promise<string> Data received from the server
   */
  private async recv(): Promise<string> {
    const data = new Buffer(2048); // TODO: Fix
    await this.conn.read(data);
    const length = data.readInt32LE(0);
    const id = data.readInt32LE(4);
    const type = data.readInt32LE(8);

    if (id !== 0x69420 && type === 2) throw "Authenication Failed";

    let str = data.toString("utf-8", 12, data.length - 2);

    if (str.charAt(str.length - 1) === "\n") {
      str = str.substring(0, str.length - 1);
    }

    return str.replace(/\0/g, '') || "";
  }
}

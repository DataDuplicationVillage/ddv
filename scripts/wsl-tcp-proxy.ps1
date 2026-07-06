param(
    [Parameter(Mandatory = $true)]
    [string]$HostName,

    [Parameter(Mandatory = $true)]
    [int]$Port
)

$ErrorActionPreference = "Stop"

$source = @"
using System;
using System.IO;
using System.Net.Sockets;
using System.Threading.Tasks;

public static class WslTcpProxy
{
    public static int Run(string hostName, int port)
    {
        using (var client = new TcpClient())
        {
            client.Connect(hostName, port);

            using (var network = client.GetStream())
            using (var stdin = Console.OpenStandardInput())
            using (var stdout = Console.OpenStandardOutput())
            {
                var inputTask = Task.Run(delegate
                {
                    try
                    {
                        stdin.CopyTo(network);
                        network.Flush();
                        client.Client.Shutdown(SocketShutdown.Send);
                    }
                    catch
                    {
                    }
                });

                var outputTask = Task.Run(delegate
                {
                    try
                    {
                        network.CopyTo(stdout);
                        stdout.Flush();
                    }
                    catch
                    {
                    }
                });

                Task.WaitAny(inputTask, outputTask);

                try
                {
                    client.Close();
                }
                catch
                {
                }

                try
                {
                    Task.WaitAll(new Task[] { inputTask, outputTask }, 1000);
                }
                catch
                {
                }
            }
        }

        return 0;
    }
}
"@

Add-Type -TypeDefinition $source -Language CSharp
[Environment]::Exit([WslTcpProxy]::Run($HostName, $Port))

import datetime
import os
import sys
import tempfile

from mininet.topo import Topo, SingleSwitchTopo
from mininet.net import Mininet
from mininet.node import OVSController
from mininet.util import dumpNodeConnections
from mininet.log import setLogLevel

PROMPT = 'HashLatticeMininet>'

def main(argv):
    # The following is shamelessly lifted from https://github.com/mininet/mininet/wiki/Introduction-to-Mininet
    # TODO: actually use settings
    print >> sys.stderr, 'awaiting input'
    settings = raw_input();
    print >> sys.stderr, 'got input'
    # TODO : generalize this to allow custom topologies
    topo = SingleSwitchTopo(3)
    net = Mininet(topo = topo, controller = OVSController)
    net.start()
    hosts = net.hosts
    # END shameless lifting

    print ','.join([h.name + ' ' + h.IP() for h in hosts])
    sys.stdout.flush()
    print >> sys.stderr, 'joined some stuff'

    tmpdir = tempfile.mkdtemp()
    pipe_names = set()
    named_pipes = set()

    while True:
        # print PROMPT,
        user_in = raw_input()
        print >> sys.stderr, 'got user input:', user_in

        if len(user_in.split()) < 2:
            print 'Usage: <hostname> <command>'
            continue

        hostname = user_in.split()[0]
        command = user_in[len(hostname) + 1:]

        try:
            # get host from provided hostname
            host = net.get(hostname)

            # set up named pipe
            time_now = datetime.datetime.now()

            pipe_name = os.path.join(tmpdir, 'namedpipe-' + time_now.strftime("%Y-%m-%d_%I:%M:%s.%f"))
            pipe_names.add(pipe_name)

            os.mkfifo(pipe_name)
            named_pipe = open(pipe_name, 'w+')
            named_pipes.add(named_pipe)

            # execute command on host, writing output to named pipe
            host.popen(command, stdout=named_pipe)
            print pipe_name
            print >> sys.stderr, 'printed pipe name'
            sys.stdout.flush()
        except KeyError:
            sys.stderr.write('Invalid virtual hostname ' + hostname)
        except OSError:
            sys.stderr.write('Error creating named pipe.')

    # clean up temp files
    for pipe in named_pipes:
        pipe.close()
    for filename in pipe_names:
        os.remove(filename)
    os.rmdir(tmpdir)

if __name__ == '__main__':
    main(sys.argv)

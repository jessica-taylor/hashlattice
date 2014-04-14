import datetime
import mininet
import os
import sys
import tempfile

PROMPT = 'HashLatticeMininet> '

def main(argv):
    # The following is shamelessly lifted from https://github.com/mininet/mininet/wiki/Introduction-to-Mininet
    # TODO : generalize this to allow custom topologies
    topo = SingleSwitchTopo(3)
    net = Mininet(topo)
    net.start()
    hosts = net.hosts
    # END shameless lifting

    tmpdir = tempfile.mkdtemp()
    pipe_names = set()
    named_pipes = set()

    while True:
        print PROMPT,
        user_in = raw_input()

        if len(user_in.split()) < 2:
            print 'Usage: <hostname> <command>'

        hostname, command = user_in.split()[0], user_in.split()[1:]

        try:
            if hostname[0] != 'h':
                raise ValueError

            # set up named pipe
            time_now = datetime.datetime.now()
            pipe_name = os.path.join(tmpdir, ''.join('namedpipe-', time_now.strftime("%Y-%m-%d_%I:%M:%s.%f")))
            pipe_names.add(pipe_name)
            os.mkfifo(pipe_name)
            named_pipe = open(pipe_name, 'w')
            named_pipes.add(named_pipe)

            hosts[int(hostname[1:])-1].popen(*command, stdout=named_pipe) # ashwins1: is it *command or just command?
            print 'Writing output to named pipe', pipe_name
        except ValueError:
            print 'Invalid virtual hostname', hostname
        except OSError:
            print 'Error creating named pipe.'

    # clean up temp files
    for pipe in named_pipes:
        pipe.close()
    for filename in pipe_names:
        os.remove(filename)
    os.rmdir(tmpdir)

if __name__ == '__main__':
    main(sys.argv)

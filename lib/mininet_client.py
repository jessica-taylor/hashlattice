import mininet
import sys

PROMPT = 'HashLatticeMininet> '

def main(argv):
    # The following is shamelessly lifted from https://github.com/mininet/mininet/wiki/Introduction-to-Mininet
    # TODO : generalize this to allow custom topologies
    topo = SingleSwitchTopo(3)
    net = Mininet(topo)
    net.start()
    hosts = net.hosts
    # END shameless lifting

    while True:
        print PROMPT,
        user_in = raw_input()

        if len(user_in.split()) < 2:
            print 'Usage: <hostname> <command>'

        hostname, command = user_in.split()[0], user_in.split()[1:]

        try:
            if hostname[0] != 'h':
                raise ValueError
            # TODO : named pipe stuff
            hosts[int(hostname[1:])-1].popen(*command)
        except ValueError:
            print 'Invalid virtual hostname', hostname

if __name__ == '__main__':
    main(sys.argv)

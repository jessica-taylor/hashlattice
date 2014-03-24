# HashLattice

A distributed network based on hash codes and lattices.

### Why do this?

Peer-to-peer systems such as Bittorrent and Bitcoin can perform useful tasks without central authority.  However, each of these systems is difficult to program and requires its users to install different software for each application.  With HashLattice, you could implement a peer-to-peer system by only writing code related to the system's functionality without worrying about how the underlying peer-to-peer network functions, or managing dependencies.  Users could use the system simply by visiting a location in their Web browser after installing HashLattice software, but without having to install different software for each application.  In theory, this system could allow the implementation of systems such as:

- Facebook with no central web server or authority
- Code sharing without worrying about dependency management
- Bitcoin (without installing the Bitcoin software), and web applications using Bitcoin

### Distributed file sharing

HashLattice is built on a base of distributed file sharing.  It is possible to assign hash codes to documents and use this hash code as the name of the document.  Then, a protocol such as BitTorrent can be used to download the document from peers.  BitTorrent already implements this system using magnet links.

Rather that share arbitrary binary files, HashLattice allows the sharing of _data values_.  Data values are like JSON objects: it is possible to represent strings, numbers, arrays, and dictionaries.  Additionally, byte arrays are also considered to be data objects (which allows efficiently representing binary files).  Data values can be encoded in binary, so the file sharing network can easily be adapted to share data objects.

### Computations

Sometimes, it's useful to distribute a compressed version of a file, rather than the file itself.  But what if the user doesn't have the decompression algorithm installed?  In this case, you might consider providing the compressed file along with the decompression algorithm.

HashLattice allows doing this (and more) using computations.  Think of a computation as a bundle containing both data and some Javascript code for transforming it.  The actual data objects shared on the HashLattice network are computations, rather than the original data objects.

### Dependency management

What if you want to distribute multiple files that are compressed with the same algorithm?  It would be wasteful to distribute the same compression algorithm multiple times.

To handle this issue, HashLattice allows computations to fetch data based on its hash code.  So, you could distribute the compressed file along with some code that will fetch the decompression algorithm's source code (using the hash of the source) and then use `eval()` to run the code on the compressed file.  This will prevent the user from having to download the compression multiple times, as it will be cached.

This facility can do more than just make decompression easier.  It is possible to create files that are derived from existing files.  For example, there might be an old version of a document already in the network when you want to publish a new version.  You can publish a computation that uses the diff between the old and new versions, along with the old file, to construct the new version.  Users who have already downloaded the old file will only need to download the diff.

It is also possible to split a file up into many different pieces that are combined with some decoding function.  The decoding function may perform functions such as concatenation, xor, and decryption on the parts.  Then, the owner can use a computation that retrieves the pieces and feeds them through the decoding function.  For comparison, see the [OFF system](http://offsystem.sourceforge.net/).

### Functions

Using `eval()` like this is inconvenient.  This is why HashLattice allows computations to return arbitrary values, which can contain functions.  A _value_ is defined the same way a data value is defined (it can be a string, number, list, or dictionary), but it can also be a function that takes values as arguments and returns values.  The decompression algorithm used previously could be specified as a computation returning a decompression function, rather than a computation returning source code.

Functions make it easy to interface HashLattice with programming languages.  Most scripting languages (including Javascript, Python, Ruby, and Perl) have an easy way to represent values, and other languages (such as Java and C++) can represent them with a bit more difficulty.  Therefore, it is possible to provide a library that can be used like this:

        import paos
        lib = paos.getFromHash('<sha256 hash code>')
        lib.function(5)

This will often be much easier than installing language-specific libraries, which may or may not even exist.  Since HashLattice includes dependency management, it can be used like a package manager for Javascript code that can be called from many different languages.  The HashLattice package provided to the host language can call an external process to handle function calls.

### User Interface

In addition to a shell and programming language integration, HashLattice will have web browser integration in the form of a browser extension.  When a URL of the form `paos://<hash>` is visited, the browser downloads a data value corresponding to the given hash and interprets it as an HTML page.  The page may be downloaded from peers in the network; no central web server is necessary.  The Javascript on the HTML page will be able to access HashLattice functions such as retrieving documents from their hash value.  With user permission, it will be able to put data in the system.  This enables easy distribution of applications that work with HashLattice: simply distribute the hash of a computation returning the application's HTML page.  Obviously, it is also possible for the browser to display file types other than HTML.

### Variables

So far, the system can do a lot, but it is very static.  Documents representing computations are inserted into the system and can be downloaded and used to define new documents, but nothing really changes over time except that more files get added.

Enter variables.  As the name suggests, variables specify a value that may change over time.  Each computer in the network will store a current data value for all variables it knows about.  It will communicate with other computers to update its value.

If I already have one value for a particular variable, and I hear about another value from another computer on the network, how do I know how to update my value?  Each variable specifies exactly how to do this with a merge function.  `merge` should take two values (the current one the computer knows about, and the one it heard from somewhere else) and produce a new value.  Think of `merge` as either choosing the better value between the two, or combining the best of both values into a unified whole.  Formally, `merge` will usually be a least upper bound operator in a [semilattice](http://en.wikipedia.org/wiki/Semilattice).  Variables also specify a default value.  HashLattice web pages are allowed to fetch the current best value for any variable.

### Applications

Variables are quite powerful.  Consider a variable that stores the latest version of a document that has been signed by a particular public key.  To merge 2 documents, select the properly signed document with the latest time stamp, or `null` (the default) if neither document is valid.

Now it is possible to create a webpage that will fetch this variable.  It can display whatever document is associated with the variable.  The result is that the webpage is automatically updated whenever a new version of the document is published.  Since the initial HTML/Javascript for the webpage remains the same, the webpage will maintain the same hash code even when the document is updated.

Much more is possible with variables.  Perhaps you want to publish a list of messages signed with a particular public key (think Twitter).  Then define a variable representing a set of all messages signed by a particular person.  To merge two sets, take their union (and discard messages that are not properly signed).

It is possible to create a messaging service (like Facebook) this way.  For each user, have one variable corresponding to a list of (encrypted) messages they have sent to other people, and another corresponding to their list of friends (which is a simple versioned document).  Now it is possible to create a webpage showing all messages addressed to a user (which requires prompting the user for their decryption key, of course).  It will first fetch the user's friends list, then fetch the list of messages sent by each friend in the list, filtering messages to ensure they are sent to this particular person.  This is not the most efficient system, but other more efficient systems (using indexes) can also be implemented using variables.

Surprisingly, Bitcoin can also be implemented using variables.  The block chain can be represented as a linked list, where each node in the list stores both a single block and the hash code of the chronologically previous node.  The main variable would be "longest valid block chain".  Merge block chains by checking that they are both valid and proceeding to select the longest valid one (choosing the old value if both are equally valid and long).  For efficiency, it will be useful to cache some computations, such as a function that determines the validity of a block chain up to a given block, in addition to account balances at this block.  This function can be used recursively (with appropriate caching) to evaluate later blocks.

## Appendix: Technical Details

### Data

The main data type of HashLattice is a variant of JSON.  It is exactly like JSON, except that it also contains byte arrays as a data type.  Also, data can be binary encoded, similar to BSON.  Perhaps it would be good to simply use a subset of BSON.

### Code

The main programming language used in HashLattice is Javascript.  It may be good to support additional languages eventually.  HashLattice data can easily be manipulated in Javascript.  Only a subset of language features are allowed:

- no IO
- no randomness
- no checking the time
- etc.

The intention is that it's as close to a purely functional programming language you can get while still allowing internal data to be mutated.  This restriction can be accomplished with a Javascript sandbox.

### Computations

A *computation* is some Javascript code that produces a value and can access a few functions that are guaranteed to be deterministic.  Specifically, the form of the computation is data:

    {'data': {
        // a mapping from variable name to data
     },
     (optional) 'cache': // boolean of whether to cache this computation
     'code': '// a Javascript expression that can use data variables and some functions'
    }

Every computation produces a deterministic result when evaluated.  The code is allowed to call a `evalComputation(comp)` function, which takes a computation and returns its evaluation.

If the `cache` boolean is set to true, then the system will attempt to cache the result of this computation.  The result of the computation must be data for this to work.

### Hash codes

The main hash function used in HashLattice is SHA256.  It is possible to find the hash of a data value by finding the hash of its canonical binary representation.  Specifically, it is possible to find hash codes of computations, as they are all data values.  The system (and eventually, the network) should store a mapping from hash codes to computations.  Then, it is possible to provide a function that maps from a hash code to the result of evaluating the computation with this hash code.  This function is provided to computations and is called `getHash(code)`.  Like `evalComputation`, `getHash` will take advantage of caching.  Hash codes can be easily used for dependency management, as explained in the applications section of this document.

### Variables

A variable is an object of the following form:

    {'merge': function(current, next) {
       // current and next are both data values corresponding to the variable
       // we already have current as our value, and just heard about next
       // return the new value we should store for this variable
       // which may be current, next, or a combination
     }

     (optional) 'default': // initial value we store for the variable
                           // if unspecified, this will be null
    }

If we see a list of values, we will start with the default and then proceed to merge with all the values in order.  It is also necessary to push new values out to the network.  There is probably a good algorithm for this.

Variables are values, so they can be specified as the result of evaluating a computation.  Therefore, we can identify variables with the hash of the computation producing the variable.  The fact that predicates are the result of evaluating a computation implies that predicates can use the `getHash` function.  This makes it possible to, for example, create a predicate over linked lists in which the pointer of a linked list is represented as a hash code.

### API

HashLattice provides an API, which is accessible in a Javascript shell, other programming languages, and HashLattice web pages.  The API contains the following functions (TODO, this is incomplete):

- `evalComputation`: Given a computation, evaluate it.  This uses caching.
- `getHash`: Given a hash code for a computation, try to download and evaluate it.  This also using caching.
- `getVar`: Given a variable hash, return the current value for the variable.  This may require querying peers.
- `putVar`: Given a variable computation and a new value, merge the current value with the new value.  This may cause the new value to be pushed to other computers in the network.

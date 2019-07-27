# bundl.config.js
Bundl runs under a configuration file.
The configuration file is a javascript file which exports a module.

```
module.exports = {
  ...
};
```
## Main options:
> * outputBase: Generated files will be all within this directory, they will be nested inside following their input path.
> * inputBase: Files will be looking for from this directory.
> * watch: Path to a folder to keep looking for changes.
> * clean: If set to true, outputBase will be empty before start packing.
> * output: Object which contains output path as key and configuration.

*IE:*
```
module.exports = {
  "outputBase": "build",
  "watch": "src",
  "inputBase": "src",
  "clean": true,
  "output": {
    ...
  }
};
```

## Output

It is an object where its keys are the output folder within outputBase and its content cant be:

> * Simple string: Path to single input file.
>
>   `"output/subfolder":"input.txt"`
> * String array: An array of paths to input files.
>
>   `"output/subfolder":["input1.txt","input2.txt"]`
> * Object: A configuration object for given output.
>
>   `"output/subfolder":{input:"input.txt", ...}`
> * Object array: An array of configuration objects.
>
>   `"output/subfolder":[{input:"input1.txt", ...},"input2.txt"]`
> * Mixed object and string array.
>
>   `"output/subfolder":[{input:"input1.txt", ...},"input2.txt"]`
## Output options

> * clean: If set to true, current output directory will be empty before pack it. It doesn't empty the outputBase, it empties *outputBase + current output key.*
> * parse: Use hash for given key.
> * order: Set pack order to given key and make it works synchronous only for those keys with order set. Not sorted keys will be done at the end in asynchronous way.
> * id: Identification for hashes.
> * use: `function(entry){return entry;}`
> * input: Object with input files
> 
> IE
> ```
> "output":{
>   "outputfile.ext":{
>   "clean":true,
>   "order":0,
>   "id":"example",
>   "input":{"inputfile.ext"}
>   }
>}
> ```
> **Hash**
>
> Output key has hash property to insert as a part of the name. If the file has changes, a new hash will be generated and the old file won't be overwritten. The syntaxis is `{{hash}}`
>
> IE
> ```
> "output":{
>   "bundle.{{hash}}.js:{
>   "id": "bundle.js",
>   ...
>   }
>}
> ```

## Input object
Input keys are file paths to pack.
The input full path will be `inputbase/input`.

The content can be a boolean true just to mark the file as required.
```
"input":{
  "file.ext":true
}
```
Or it can be an object with options:
> * parse: Run meta for given key.
> * use: `function(entry){return entry;}`
> * read: If set to false, file content will be ignored and must be generated using `use` function.

If input starts with **!** it will exclude that pattern.
```
"input":{
  "file.*":true,
  "!file.html":true
}
```

## Use
A function which allow the user to modify the content and the file name.

Use can be used either at output object or at input object. The function has the same syntax but some differences.
### Syntax
```
function(entry){
  // Do something
  return entry;
}
```
The function has one parameter, entry. And it has to return it again.
* Output use:
Entry is an object with the following keys:
> * fileName: Name of the file that will be generated.
> * content: Content of the file.
> IE
> ```
> "use":function (entry) {
>   entry.fileName = entry.fileName.replace(".less", ".css");
>   entry.content += "\nconsole.log(\"output use\");";
>   return entry;
>}
> ```
* Input use:
Entry is an object with the following keys:
> * fileName: Name of the file that will be generated.
> * content: Content of the file.
> IE
> ```
> "use":function (entry) {
>   entry.fileName = entry.fileName.replace(".less", ".css");
>   entry.content += "\nconsole.log(\"output use\");";
>   return entry;
>}
> ```

**It is important to know that input use will be done before output use.**

**Use allows async functions with await.**
IE
```
"use": async function (entry) {
  entry.content = await doSomething(entry.content);
  return entry;
}
```


*There are some other properties at entry object such as pattern for input, they can be useful but their modification will not be taken in the pack process.*

### Less example
Using *"use"* to parse less files:
```
"input": {
  "less/**.less": {
    "use": async function (entry) {
      try {
        entry.fileName = entry.fileName.replace(".less", ".css");
        entry.content = (await require("less").render(entry.content.toString("utf8"), {
        filename: require("path").resolve(entry.file),
        })).css;
        } catch (error) {
          console.log(error);
        }
        return entry;
      }
    }
  }
```


## Query params
Output keys allow output options to be passed as query params.

IE
```
"index.html?clean=false&parse=true":"html/index.html"
```
is the same as:
```
"index.html":{
  "clean":false,
  "parse":true,
  input:{
    "html/index.html":true
  }
}
```
All query params affect to every output key. If the output key has already the property, it won't be affected by the query param.

IE
```
"index.html?clean=false&parse=true":{
  "clean":true,
  "input":"html/index.html"
}
```
is the same as:
```
"index.html":{
  "clean":true,
  "parse":true,
  input:{
    "html/index.html":true
  }
}
```
Inside property prevails.
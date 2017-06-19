"use strict";

var path = require('path');
var i18Gen = require('./i18n/i18n-gen');

//文件过滤设置
fis.set('project.ignore', ['node_modules/!**', 'output/!**', 'fis-conf.js']);
//默认设置
fis.set('statics', '/.static');
fis.set('namespace', '');
fis.set('domain', '');
fis.hook('relative');

fis.hook('cmd');

//编译前读取翻译文件
fis.once('compile:start', function (file) {
    i18Gen.getLang();
});

fis.match('**', {

    useMap: true,
    useHash: true,
    relative: true,
    release: false,
    preprocessor: fis.plugin('replacer', {
        ext: '.js',
        from: /(['"])common:(components|widget|static)/g,
        to: '$1as-common:$2'
    })
})
    .match('/(**)', {
        isMod: true,
        release: '${statics}/${namespace}/$1'
    })
    .match('(**).tmpl', {
        release: '${statics}/${namespace}/$1',
        rExt: '.js',
        isMod: true,
        parser: [fis.plugin('bdtmpl', {
            LEFT_DELIMITER: '<%',
            RIGHT_DELIMITER: '%>'
        })]
    })

    .match('/(**).js', {
        isMod: true,
        optimizer: fis.plugin('uglify-js'),
        useHash: true,
        parser: [require('./lite-plugin').compileJS],
        postprocessor: [
            fis.plugin('cmdwrap'),
            //提取js中i18n，生成key
            require('./i18n/i18n-js-postprocessor')
        ]
    })
    .match(/\/(layout|globals?|assets?)\/.*\.js/, {
        isMod: false,
        optimizer: fis.plugin('uglify-js'),
        useHash: true,
        parser: [require('./lite-plugin').exportJS],
        postprocessor: [require('./lite-plugin').compileJS]
    })
    .match('/lib/(**)', {
        useHash: false,
        useCompile: false,
        useParser: false,
        usePreprocessor: false,
        useStandard: false,
        usePostprocessor: false,
        isMod: false,
        parser: false
    })
    .match('::image', {
        useMap: true
    })
    .match('/**.less', {
        parser: [fis.plugin('less-common'), fis.plugin('less')], //启用fis-parser-less插件
        rExt: '.css'
    })
    .match('/**.{css,less}', {
        optimizer: fis.plugin('clean-css'),
        //autoprefixer 前缀处理
        postprocessor: fis.plugin("autoprefixer", {
            "browsers": ['last 2 versions', '> 5%', 'ie 8'],
            "flexboxfixer": true,
            "gradientfixer": true
        })
    })
    //widget处理
    .match('/(widget/**)', {
        //  url: '${namespace}/$1',
        release: '${statics}/${namespace}/$1',
        isMod: true
    })

    .match('/(widget/ui/(components/**))', {
        id: '$2',
        release: '${statics}/${namespace}/$1',
        isMod: true
    })
    //模板不产出
    .match('/(**.xhtml)', {
         useHash: false,
         useMap: false,
        //url: '/$1',
        release: 'views/lite-temp.xhtml',
        //release: false,
        postprocessor: [
            //提取lite中i18n，生成key
            require('./i18n/i18n-lite-postprocessor')
        ]
    })
    //widget下单文件 lite预编译成js，方便前端使用 todo
    /*    .match('/(widget/!**).xhtml', {
     release: '${statics}/${namespace}/$1_xhtml',
     rExt: '.js',
     isMod: true,
     parser: [require('./lite-plugin').compileLite]
     })*/
    //产出到views 供模板使用
    .match('/(manifest.json)', {
        useHash: false,
        url: '/$1',
        release: '/$1',
        //release:'${statics}/${namespace}/$1',
        useMap: false
    })
    .match('/(map.json)', {
        useHash: false,
        release: '${statics}/${namespace}/$1'
    })
;
fis.match('::packager', {
    postpackager: [
        i18Gen.deploy,
        //生成i18njs文件提供页面加载
        require('./i18n/i18n-js-postpackager'),
        fis.plugin('seajs')
    ]
});

//本地测试环境 不压缩 不预编译
fis.media('debug').match('/**', {
    useHash: false,
    useSprite: false,
    optimizer: null,
    domain: '${domain}',
    deploy: [
        deploy,
        require('./lite-precompile'),

    ]
});

//dev环境 不压缩 模板预编译
fis.media('dev')
    .match('/**', {
        optimizer: null,
        domain: '${domain}',
        deploy: [
            deploy,
            require('./lite-precompile'),
           // i18Gen.deploy
        ]
    });

//prod环境 开启压缩 模板预编译
fis.media('prod')
    .match('/**', {
        domain: '${domain}',
        deploy: [
            deploy,
            require('./lite-precompile'),
          //  i18Gen.deploy
        ]
    });

/**
 * 静态资源产出
 * @param options
 * @param modified
 * @param total
 * @param next
 */
function deploy(options, modified, total, next) {
    /*
     fis.plugin('local-deliver', {
     to: '../'
     })
     */
    var plugin = fis.require('deploy-local-deliver');
    //var releasePath = path.join(fis.get('utopiaAppDir'), 'app/public/.static/');
    var releasePath = getReleasePath();
    options.to = releasePath;
    plugin.apply(null, arguments);
}

function getReleasePath() {
    return path.join(fis.get('utopiaAppDir'), 'node_modules/.ua-release-webroot/');
}
exports.getReleasePath = getReleasePath;
